;(function () {
    $(window).load(function () {
        $('body').addClass('loaded');

        var menu = $('#menu'),
            menuName = $('#menu-title'),
            subMenu = $('#sub-menu'),
            iconMenu = $('#icon-menu');

        menu.on('click', function (e) {
            e.preventDefault();
            subMenu.toggle("active");
            menuName.toggleClass("active");
            iconMenu.toggleClass("active");
        });

        $('.icon-fullscreen').on('click', function () {
            var isFullscreen = (document.fullScreenElement && document.fullScreenElement != null)
                || (document.mozFullScreen || document.webkitIsFullScreen);

            if (!isFullscreen) {
                var body = document.body;
                var method = body.requestFullScreen || body.webkitRequestFullScreen
                    || body.mozRequestFullScreen || body.msRequestFullScreen;
                method.call(body);

            } else {
                var method = document.exitFullscreen || document.webkitExitFullscreen
                    || document.mozCancelFullScreen || document.msExitFullscreen;
                method.call(document);
            }
        });

    });


})();