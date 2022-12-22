'use strict';

/**
 * @namespace Checkout
 */

var server = require('server');

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

/**
 * Main entry point for Checkout
 */

/**
 * Checkout-Begin : The Checkout-Begin endpoint will render the checkout shipping page for both guest shopper and returning shopper
 * @name Base/Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {middleware} - server.middleware.https
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - csrfProtection.generateToken
 * @param {querystringparameter} - stage - a flag indicates the checkout stage
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.get(
    'Begin',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var AccountModel = require('*/cartridge/models/account');
        var OrderModel = require('*/cartridge/models/order');
        var URLUtils = require('dw/web/URLUtils');
        var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
        var Locale = require('dw/util/Locale');
        var collections = require('*/cartridge/scripts/util/collections');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
        var Site = require('dw/system/Site');
        var viewData = res.getViewData();
        var enableSustainability = Site.getCurrent().getCustomPreferenceValue('enableSustainability');
        viewData.enableSustainability = enableSustainability;
        res.setViewData(viewData);
        var treeCostValues = JSON.parse(Site.getCurrent().getCustomPreferenceValue('addTree'));
        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.redirect(URLUtils.url('Cart-Show'));
            return next();
        }

        var validatedProducts = validationHelpers.validateProducts(currentBasket);
        if (validatedProducts.error) {
            res.redirect(URLUtils.url('Cart-Show'));
            return next();
        }

        var accountModel = new AccountModel(req.currentCustomer);

        var requestStage = req.querystring.stage;
        var currentStage = requestStage || 'customer';
        var billingAddress = currentBasket.billingAddress;

        var currentCustomer = req.currentCustomer.raw;
        var currentLocale = Locale.getLocale(req.locale.id);
        var preferredAddress;
        var shipmentLineItems = currentBasket.shipments;
        if (accountModel.registeredUser) {
            collections.forEach(shipmentLineItems, function (item) {
                for (var i = 0; i < item.shippingLineItems.length; i++) {
                    for (var x = 0; x < treeCostValues.length; x++) {
                        if (item.shippingLineItems[i].custom.isSustainable === true && treeCostValues[x].id === item.shippingLineItems[i].ID) {
                            treeCostValues[x].checked = 'checked';
                        }
                    }
                }
            });
        }

        // only true if customer is registered
        if (req.currentCustomer.addressBook && req.currentCustomer.addressBook.preferredAddress) {
            var shipments = currentBasket.shipments;
            preferredAddress = req.currentCustomer.addressBook.preferredAddress;

            collections.forEach(shipments, function (shipment) {
                if (!shipment.shippingAddress) {
                    COHelpers.copyCustomerAddressToShipment(preferredAddress, shipment);
                }
            });

            if (!billingAddress) {
                COHelpers.copyCustomerAddressToBilling(preferredAddress);
            }
        }

        // Calculate the basket
        Transaction.wrap(function () {
            COHelpers.ensureNoEmptyShipments(req);
        });

        if (currentBasket.shipments.length <= 1) {
            req.session.privacyCache.set('usingMultiShipping', false);
        }

        if (currentBasket.currencyCode !== req.session.currency.currencyCode) {
            Transaction.wrap(function () {
                currentBasket.updateCurrency();
            });
        }

        COHelpers.recalculateBasket(currentBasket);

        var guestCustomerForm = COHelpers.prepareCustomerForm('coCustomer');
        var registeredCustomerForm = COHelpers.prepareCustomerForm('coRegisteredCustomer');
        var shippingForm = COHelpers.prepareShippingForm();
        var billingForm = COHelpers.prepareBillingForm();
        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');

        if (preferredAddress) {
            shippingForm.copyFrom(preferredAddress);
            billingForm.copyFrom(preferredAddress);
        }

        // Loop through all shipments and make sure all are valid
        var allValid = COHelpers.ensureValidShipments(currentBasket);

        var orderModel = new OrderModel(
            currentBasket,
            {
                customer: currentCustomer,
                usingMultiShipping: usingMultiShipping,
                shippable: allValid,
                countryCode: currentLocale.country,
                containerView: 'basket'
            }
        );

        // Get rid of this from top-level ... should be part of OrderModel???
        var currentYear = new Date().getFullYear();
        var creditCardExpirationYears = [];

        for (var j = 0; j < 10; j++) {
            creditCardExpirationYears.push(currentYear + j);
        }


        var reportingURLs;
        reportingURLs = reportingUrlsHelper.getCheckoutReportingURLs(
            currentBasket.UUID,
            2,
            'Shipping'
        );

        if (currentStage === 'customer') {
            if (accountModel.registeredUser) {
                // Since the shopper already login upon starting checkout, fast forward to shipping stage
                currentStage = 'shipping';

                // Only need to update email address in basket if start checkout from other page like cart or mini-cart
                // and not on checkout page reload.
                if (!requestStage) {
                    Transaction.wrap(function () {
                        currentBasket.customerEmail = accountModel.profile.email;
                        orderModel.orderEmail = accountModel.profile.email;
                    });
                }
            } else if (currentBasket.customerEmail) {
                // Email address has already collected so fast forward to shipping stage
                currentStage = 'shipping';
            }
        }

        res.render('checkout/checkout', {
            order: orderModel,
            customer: accountModel,
            forms: {
                guestCustomerForm: guestCustomerForm,
                registeredCustomerForm: registeredCustomerForm,
                shippingForm: shippingForm,
                billingForm: billingForm
            },
            treeCostValues: treeCostValues,
            expirationYears: creditCardExpirationYears,
            currentStage: currentStage,
            reportingURLs: reportingURLs,
            oAuthReentryEndpoint: 2
        });

        return next();
    }
);

server.post(
    'Tree',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    // eslint-disable-next-line consistent-return
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var collections = require('*/cartridge/scripts/util/collections');
        var OrderModel = require('*/cartridge/models/order');
        var currentCustomer = req.currentCustomer.raw;
        var currentBasket = BasketMgr.getCurrentBasket();
        var singleTreeCost = Number(req.querystring.tree);
        var mappingPointsValue = {
            'treeCost1': 5,
            'treeCost2': 10,
            'treeCost3': 15,
            'treeCost4': 20
        };
        var treeCostId = req.querystring.id;
        if (currentBasket) {
            var shipmentLineItems = currentBasket.shipments;
            if (singleTreeCost !== 0) {
                collections.forEach(shipmentLineItems, function (ship) {
                    Transaction.wrap(function () {
                        var sustainShippingLineItem = ship.createShippingLineItem(treeCostId);
                        sustainShippingLineItem.setPriceValue(singleTreeCost);
                        sustainShippingLineItem.setLineItemText('contribution cost');
                        sustainShippingLineItem.custom.isSustainable = true;
                        sustainShippingLineItem.custom.neutralizedPoints = mappingPointsValue[treeCostId];
                    });
                });
            } else {
                collections.forEach(shipmentLineItems, function (ship) {
                    Transaction.wrap(function () {
                        var lineItemShip = ship.getShippingLineItem(treeCostId);
                        ship.removeShippingLineItem(lineItemShip);
                    });
                });
            }
            COHelpers.recalculateBasket(currentBasket);
            var orderModel = new OrderModel(
                currentBasket,
                {
                    customer: currentCustomer,
                    containerView: 'basket'
                }
            );
            res.json({
                orderModel: orderModel
            });
            return next();
        }
    }
);
module.exports = server.exports();
