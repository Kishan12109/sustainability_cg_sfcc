'use strict';
// eslint-disable-next-line no-unused-vars

module.exports = function (object, apiProduct) {
    Object.defineProperty(object, 'carbonPoints', {
        enumerable: true,
        value: apiProduct.custom.carbonPoints
    });

    Object.defineProperty(object, 'isSustainaibleProduct', {
        enumerable: true,
        value: apiProduct.custom.isSustainaibleProduct
    });
};
