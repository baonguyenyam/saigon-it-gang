App.ClickControl.prototype.clicked = function (intersects, mouseKey) {
    var x = intersects[0].object.resource.match(/[^\s\/]+\.(?:jpg|png|jpeg|gif)$/i);
    var portfolioUrl = document.location.href.replace(/[^\/\\]+$/, '') + "portfolio.html#" + x[0];

    if (mouseKey != App.MOUSE_MIDDLE) {
        document.location.href = portfolioUrl;
    } else {
        window.open(portfolioUrl);
        window.focus();
    }
};

