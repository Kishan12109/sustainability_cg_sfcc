'use strict';
// eslint-disable-next-line no-unused-vars

module.exports = function (object, apiProduct) {
    Object.defineProperty(object, 'productTotalCarbonPoints', {
        enumerable: true,
        value: apiProduct.custom.productTotalCarbonPoints
    });

    Object.defineProperty(object, 'productMaterialCarbonPoints', {
        enumerable: true,
        value: apiProduct.custom.productMaterialCarbonPoints
    });

    Object.defineProperty(object, 'productPackagingCarbonPoints', {
        enumerable: true,
        value: apiProduct.custom.productPackagingCarbonPoints
    });

    Object.defineProperty(object, 'productEnergyCarbonPoints', {
        enumerable: true,
        value: apiProduct.custom.productEnergyCarbonPoints
    });

    Object.defineProperty(object, 'productTransportCarbonPoints', {
        enumerable: true,
        value: apiProduct.custom.productTransportCarbonPoints
    });

    Object.defineProperty(object, 'productBadge', {
        enumerable: true,
        value: apiProduct.custom.productBadge
    });
};
