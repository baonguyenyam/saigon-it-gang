;(function () {
    var imageSrc = window.location.hash.substr(1);
    var startImage = touchPhotoImages.indexOf(imageSrc);
    var resources = touchPhotoImages;
    var sliderWrapper = $('.main-wrapper');
    var swiperContainer = $('<div>', {
        class: 'swiper-container gallery-top'
    });

    var swiperContainerThumbs = $('<div>', {
        class: 'swiper-container gallery-thumbs fadein1'
    });
    var swipperWrapper = $('<div>', {
        class: 'swiper-wrapper'
    });


    var swipperWrapperThumb = swipperWrapper.clone();
    var buttons = $('<div class="swiper-button-next swiper-button-white"></div><div class="swiper-button-prev swiper-button-white"></div>');

    var n = resources[startImage];

    if (startImage != resources.length - 1 ){
        resources.splice(startImage, 1);
        resources.unshift(n);
    }



    for (var j = 0, l = resources.length; j < l; j++) {
        if (resources[j]) {
            var item = $('<div />', {
                class: 'swiper-slide',
                style: 'background-image:url(' + 'img/thumbs/' + resources[j] + ')'
            });

            var thumbItem = $('<div />', {
                class: 'swiper-slide',
                style: 'background-image:url(' + 'img/thumbs/' + resources[j] + ')'
            });
            swipperWrapper.append(item);
            swipperWrapperThumb.append(thumbItem);
        }
    }

    swiperContainer.append(swipperWrapper);
    swiperContainer.append(buttons);
    swiperContainerThumbs.append(swipperWrapperThumb);
    sliderWrapper.append(swiperContainer).append(swiperContainerThumbs);

    $(window).load(function () {
        // $('body').removeClass('preload');
        var galleryTop = new Swiper('.gallery-top', {
            nextButton: '.swiper-button-next',
            prevButton: '.swiper-button-prev',
            spaceBetween: 0,
            slidesPerView: 'auto',
            grabCursor: true,
            loop: true,
            updateOnImagesReady: true,
            lazyLoading: true,
            preloadImages: false
        });
        var galleryThumbs = new Swiper('.gallery-thumbs', {
            spaceBetween: 0,
            centeredSlides: true,
            slidesPerView: 'auto',
            touchRatio: 0.2,
            slideToClickedSlide: true,
            loop: true,
            updateOnImagesReady: true,
            lazyLoading: true,
            preloadImages: false,
            onInit: function () {
                $('.gallery-thumbs').css('opacity', 1);
            }
        });
        galleryTop.params.control = galleryThumbs;
        galleryThumbs.params.control = galleryTop;
    });

})();
