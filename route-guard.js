(function exposeRouteGuard(scope) {
  "use strict";

  const ORDER_ID = "[0-9]{3}-[0-9]{7}-[0-9]{7}";

  function isOrderDetailsPage(urlValue) {
    let url;
    try {
      url = new URL(String(urlValue || ""), "https://sellercentral.amazon.fr");
    } catch {
      return false;
    }

    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    const amazonOrder = new RegExp(`^/orders-v3/order/${ORDER_ID}$`, "i").test(path);
    const octopiaOrder = /^\/Order\/Detail\/[a-f0-9]{32}$/i.test(path);
    return amazonOrder || octopiaOrder;
  }

  scope.CheaplyLabelRoute = Object.freeze({ isOrderDetailsPage });
})(globalThis);
