"use strict";

var App = function (elementId, options) {
    // Если для этого элемента уже создан instance App, то не создаём ещё один
    if (App.Manager.exists(elementId)) {
        return App.Manager.get(elementId);
    } else {
        App.Manager.add(elementId, this);
    }

    // Ищем DOM-элемент
    this.element = document.getElementById(elementId);
    if (!this.element) {
        // Нет елемента, конец
        return false;
    }

    var self = this;

    // Инициализируем опции
    this.options = {
        "control": "rotate",
        "controlOptions": {},
        "clickable": false,
        "cssMode": false,
        "backgroundColor": 0x000000,
        "transparency": 1,
        "animate": false,
        "layout": "grid",
        "painter": "image"
    };
    // Считываем некоторые опции с data-атрибутов (приоритет ниже, чем у
    // переданных [через переменную options] опций)
    ['control', 'layout', 'painter'].forEach(function (optionName) {
        var attributeName = 'data-' + optionName; // "data-control"
        var defaultValue = self.options[optionName]; // "rotate"

        self.options[optionName] = App.getAttribute(self.element, attributeName, defaultValue);
    });
    // Принимаем переданные опции
    App.extend(this.options, options);

    this.objects = null;

    this.createPreloader();
    this.isLoaded = false;

    // Создание сцены, камеры, рендерера
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.element.offsetWidth / this.element.offsetHeight, 0.1, 1000);
    this.camera.position.z = 2;
    this.renderer = this.createRenderer();
    this.renderer.setSize(this.element.offsetWidth, this.element.offsetHeight);
    this.renderer.setClearColor(this.options.backgroundColor, this.options.transparency);

    // Обработчик ресайза
    window.addEventListener('resize', this.onResize.bind(this), false);

    // Сразу создаём нужные контролы
    this.control = App.ControlFactory(this.options.control, this, this.options.controlOptions);
};

App.prototype = {

    getRange: function(from, to, arr) {

        if(Array.isArray(arr) && from && to) {
            var arr = arr.map(function(item){
                return 'img/thumbs/' + item;
            });

            return arr.slice(from - 1, to);
        }
    },
    /**
     * Варианты использования:
     *     1) указать все параметры:
     *         createFigure(layout, painter, resources, options)
     *     2) передать всё, кроме опций:
     *         createFigure(layout, painter, resources)
     *     3) не передавать тип painter'а (painter по умолчанию будет "image"):
     *         createFigure(layout, resources, options)
     *     4) передать только layout и ресурсы:
     *         createFigure('cube', resources)
     *     5) передать только ресурсы и опции (layout по умолчанию будет "grid"):
     *         createFigure(resources, options)
     *     6) передать только ресурсы:
     *         createFigure(resources);
     */
    createFigure: function (layout, painter, resources, options) {
        // (2) - (6) Приведём в соответсвие названия аргументов с их содержимым
        // (если переданы не все аргументы функции)
        if (arguments.length < 4) {
            // (2) или (3) Не указаны опции или painter
            if (arguments.length == 3) {
                // Не указан painter или options
                if (typeof arguments[1] == 'string') {
                    // (2) Не указаны опции
                    options = {};
                } else {
                    // (3) Не указан painter
                    options = arguments[2];
                    resources = arguments[1];
                    painter = this.options.painter;
                }
            } else if (arguments.length == 2) {
                // (4) или (5) Либо layout с ресурсами или ресурсы с опциями
                if (typeof arguments[0] == 'string') {
                    // (4) Не указаны painter и options
                    options = {};
                    resources = painter;
                    painter = this.options.painter;
                } else {
                    // (5) Не указаны layout и painter
                    options = arguments[1];
                    resources = arguments[0];
                    painter = this.options.painter;
                    layout = this.options.layout;
                }
            } else /*if (arguments.length == 1)*/ {
                // (6) Передан только resources
                options = {};
                resources = arguments[0];
                painter = this.options.painter;
                layout = this.options.layout;
            }
        }
        // Иначе (1)

        // Устанавливаем некоторые опции, если пользователь не указал свои значения для них
        if (!options.hasOwnProperty('aspectRatio')) {
            options.aspectRatio = this.camera.aspect;
        }

        // Если до этого уже создали одну фигуру, то удаляем станые объекты со
        // сцены
        if (this.objects !== null) {
            for (var i = 0, count = this.objects.length; i < count; i += 1) {
                this.scene.remove(this.objects[i]);
            }
        }

        // Создаём новую фигуру
        this.layout = App.LayoutFactory(layout, resources, options);
        this.painter = App.PainterFactory(painter, options);

        // Добавляем новые объекты на сцену
        this.objects = this.painter.paint(this);
        this.control.reset();

        // Создаём кликер или обновляем уже существующий
        if (this.options.clickable && (painter == 'image' || painter == 'triangle')) {
            if (!this.hasOwnProperty('clicker')) {
                this.clicker = new App.ClickControl(this.element, this.objects, this.camera, this.control);
            } else {
                this.clicker.setObjects(this.objects);
            }
        }
    },

    createRenderer: function() {
        if (!this.options.cssMode) {
            return App.IS_WEBGL_RENDERER ? new THREE.WebGLRenderer({"alpha": true}) : new THREE.CanvasRenderer({"alpha": true});
        } else {
            return new THREE.CSS3DRenderer({"alpha": true});
        }
    },

    createPreloader: function() {
        this.progressWrapperEl = document.createElement("div");
        this.progressEl = document.createElement("div");
        this.progressWrapperEl.appendChild(this.progressEl);
        this.element.appendChild(this.progressWrapperEl);

        this.progressWrapperEl.style.background = "transparent";
        this.progressWrapperEl.style.textAlign = "center";
        this.progressWrapperEl.style.color = "#fff";
        this.progressWrapperEl.style.display = "table";
        this.progressWrapperEl.style.width = "100%";
        this.progressWrapperEl.style.height = "100%";

        this.progressEl.style.color = "#fff";
        this.progressEl.style.textAlign = "center";
        this.progressEl.style.verticalAlign = "middle";
        this.progressEl.style.display = "table-cell";
    },

    render: function() {
        TWEEN.update();
        this.control.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.render.bind(this));
    },

    //ресайз
    onResize: function() {
        this.control.onResize();

        var width = this.element.clientWidth;
        var height = this.element.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },

    onProgress: function (progress) {
        this.progressEl.innerHTML = 'Progress: ' + progress + '%';
    },

    onLoaded: function () {
        this.element.removeChild(this.progressWrapperEl);
        this.element.appendChild(this.renderer.domElement);
        // this.control.enabled = false;
        this.render();

        if(this.options.animate) {
            this.camera.position.y = 10;
            var i = 0;
            for (var j = this.objects.length - 1; j >= 0; j--) {
                var  e = this.objects[j];
                var tween = new TWEEN.Tween(e.position);
                tween.to(e.truePosition, 450 ).delay(25 * i++);
                tween.easing(TWEEN.Easing.Back.InOut);
                tween.start();

            }
        }


    }
};

App.Manager = (function () {
    var apps = Object.create(null);
    var watcherAdded = false;

    function onLoadProgress(item, loaded, total) {
        var progress = Math.ceil(loaded*100/total);
        for (var appId in apps) {
            apps[appId].onProgress(progress);
        }
    }

    function onLoaded() {
        for (var appId in apps) {
            apps[appId].onLoaded();
        }
    }

    return {
        "exists": function (id) {
            return (id in apps);
        },

        "add": function (id, instance) {
            apps[id] = instance;
            if (!watcherAdded) {
                THREE.DefaultLoadingManager.onProgress = onLoadProgress;
                THREE.DefaultLoadingManager.onLoad = onLoaded;
                watcherAdded = true;
            }
        },

        "get": function (id) {
            return apps[id];
        },

        "remove": function (id) {
            delete apps[id];
        }
    };
})();

// Добавляем константы
App.MOUSE_LEFT = 1;
App.MOUSE_MIDDLE = 2;
App.MOUSE_RIGHT = 3;
App.PI2 = Math.PI*2;
//Проверяем поддержку на WebGL
App.IS_WEBGL_RENDERER = (function() {
    try {
        var canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
})();

App.ctg = function (degrees) {
    var radians = THREE.Math.degToRad(degrees);
    return Math.cos(radians)/Math.sin(radians);
};

App.duplicate = function (original, count) {
    var duplicates = [];
    var template = (original !== null ? JSON.stringify(original) : JSON.stringify({}));
    for (var i = 0; i < count; i += 1) {
        duplicates.push(JSON.parse(template));
    }
    return duplicates;
};

App.extend = function(original /*, extentions1, extention2, ... */ ) {
    var argc = arguments.length;
    for (var i = 1; i < argc; i += 1) {
        var extention = arguments[i];
        if (extention) {
            Object.keys(extention).forEach(function(property) {
                original[property] = extention[property];
            });
        }
    } // Конец for
    return original;
};

App.getAttribute = function (element, attributeName, defaultValue) {
    var value = element.getAttribute(attributeName);
    if (value != null) {
        return value;
    } else {
        return defaultValue || false;
    }
};

App.hasAnyAttribute = function (element, attributes) {
    for (var i = 0, length = attributes.length; i < length; i++) {
        var value = element.getAttribute(attributes[i]);
        if (value != null) {
            return true;
        }
    }
    // Ничего не нашли
    return false;
};

App.isNumeric = function(value){
    return /^\d+(\.\d+)$/.test(value);
};

App.loadTexture = (function () {
    var textureLoader = new THREE.TextureLoader();
    return function (source) {
        return textureLoader.load(source);
    }
})();

App.ucfirst = function(value) {
    var firstChar = value.charAt(0).toUpperCase();
    return firstChar + value.substr(1, value.length - 1);
};

/**
 * @returns {THREE.Vector2}
 */
App.rotatePolar = function (x, y, dphi) {
    // Определяем радиальную координату
    var r = Math.sqrt(x * x + y * y);

    // Определяем угловую коордитану
    var phi = 0;
    if (x > 0) {
        if (y >= 0) {
            phi = Math.atan(y / x);
        } else /*if (y < 0)*/ {
            phi = Math.atan(y / x) + App.PI2;
        }
    } else if (x < 0) {
        phi = Math.atan(y / x) + Math.PI;
    } else /*if (x == 0)*/ {
        if (y > 0) {
            phi = Math.PI;
        } else if (y < 0) {
            phi = 1.5 * Math.PI;
        } else /*if (y == 0)*/ {
            phi = 0;
        }
    }

    // Переводим угол смещения в радианы и делаем смещение
    dphi = THREE.Math.degToRad(dphi);
    phi -= dphi; // Идём против часовой стрелки

    // Переводим обратно в Декартовую систему
    var cartesian = new THREE.Vector2();
    cartesian.x = r * Math.cos(phi);
    cartesian.y = r * Math.sin(phi);

    return cartesian;
};

App.Configurable = function (options) {
    this.options = {};
    if (typeof options != 'undefined') {
        App.extend(this.options, this.DEFAULTS, options);
    } else {
        App.extend(this.options, this.DEFAULTS);
    }
    this.validateOptions();
};

App.Configurable.prototype = {
    "DEFAULTS": {},

    "validateOptions": function () {}
};

"use strict";

App.ControlFactory = function (type, data, options) {
    var controlName = App.ucfirst(type) + 'Control';
    if (App.hasOwnProperty(controlName) && controlName != 'ClickControl') {
        return new App[controlName](data, options);
    } else {
        // Контрол не нашли, возвращаем пустой объект
        return new App.AbstractControl(options);
    }
};

// Класс App.AbstractControl
App.AbstractControl = function (options) {
    // Готовим опции
    this.options = {};
    if (typeof options != 'undefined') {
        App.extend(this.options, this.DEFAULTS, options);
    } else {
        App.extend(this.options, this.DEFAULTS);
    }
    this.validateOptions();

    this.enabled = true;
};

App.AbstractControl.prototype = {
    "DEFAULTS": {},

    "validateOptions": function () {},

    "update": function () {},

    "reset": function () {},

    "onResize": function () {}
};

// Класс App.RotateControl. Создаём обёртку вокруг THREE.OrbitControls
App.RotateControl = function (data, options) {
    App.AbstractControl.call(this, options);
    this.initialControl = new THREE.OrbitControls(data.camera, data.renderer.domElement);
};

// Наследуем App.RotateControl от App.AbstractControl
App.RotateControl.prototype = Object.create(App.AbstractControl.prototype);
App.RotateControl.prototype.constructor = App.RotateControl;

// Класс App.FlyControl
App.FlyControl = function (data, options) {
    App.AbstractControl.call(this, options);

    this.camera = data.camera;
    this.scene = data.scene;

    this.mouseX = 0;
    this.mouseY = 0;

    this.enabled = true;

    this.kx = 0;
    this.ky = 0;
    this.reset(); // Обновляем kx и ky

    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;

    // Добавляем обработчики
    document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    document.addEventListener('touchstart', this.onDocumentTouchStart.bind(this));
    document.addEventListener('touchmove', this.onDocumentTouchMove.bind(this));
};

App.FlyControl.prototype = Object.create(App.AbstractControl.prototype);
App.FlyControl.prototype.constructor = App.FlyControl;

App.FlyControl.prototype.DEFAULTS = {
    "disableHorizontal": false,
    "disableVertical": false,
    "scaleX": 1,
    "scaleY": 1
};

App.FlyControl.prototype.update = function () {
    if (this.enabled) {
        if (this.kx != 0) {
            this.camera.position.x += (this.mouseX - this.camera.position.x / this.kx) * this.kx * 0.05;
        }
        if (this.ky != 0) {
            this.camera.position.y += (-this.mouseY - this.camera.position.y / this.ky) * this.ky * 0.05;
        }
        this.camera.lookAt(this.scene.position);
    }
};

App.FlyControl.prototype.reset = function () {
    this.kx = (!this.options.disableHorizontal ? this.camera.position.z / window.innerWidth : 0);
    this.ky = (!this.options.disableVertical ? this.camera.position.z / window.innerHeight : 0);

    this.kx *= this.options.scaleX;
    this.ky *= this.options.scaleY;
};

App.FlyControl.prototype.onResize = function () {
    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;
};

App.FlyControl.prototype.onDocumentMouseMove = function (event) {
    this.mouseX = event.clientX - this.windowHalfX;
    this.mouseY = event.clientY - this.windowHalfY;
};

App.FlyControl.prototype.onDocumentTouchStart = function (event) {
    if (event.touches.length > 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
    }
};

App.FlyControl.prototype.onDocumentTouchMove = function (event) {
    if (event.touches.length == 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
    }
};

//Класс App.OrbitControl
App.OrbitControl = function (data, options) {
    // Вызываем конструктор родителя
    App.AbstractControl.call(this, options);



    this.camera = data.camera;
    this.scene = data.scene;

    this.mouseX = 0;
    this.mouseY = 0;

    this.enabled = true;


    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;



    this.angleX = 90;
    this.angleY = 90;

    this.scale = 1;
    this.speedX = 0;
    this.speedY = 0;

    this.teta = 0;
    this.phi = 0;

    document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    document.addEventListener('touchstart', this.onDocumentTouchStart.bind(this));
    document.addEventListener('touchmove', this.onDocumentTouchMove.bind(this));
};

App.OrbitControl.prototype = Object.create(App.AbstractControl.prototype);
App.OrbitControl.prototype.constructor = App.OrbitControl;

// Переопределяем функционал камеры для сферы
App.OrbitControl.prototype.DEFAULTS = {
    "orbitSpeed": 1
};

App.OrbitControl.prototype.update = function() {
    if (this.enabled) {
        this.angleX -= this.speedX; // Угол по X
        this.angleY += this.speedY; // Угол по Y

        // Ограничение по Y
        this.angleY = Math.max(1, Math.min(this.angleY, 179));

        this.phi = THREE.Math.degToRad(this.angleX); // Вычисляем азимутальный угол
        this.teta = THREE.Math.degToRad(this.angleY); // Вычисляем зенитный угол

        this.camera.position.x = Math.sin(this.teta) * Math.cos(this.phi) * this.scale;
        this.camera.position.z = Math.sin(this.teta) * Math.sin(this.phi) * this.scale;
        this.camera.position.y = Math.cos(this.teta) * this.scale;

        this.camera.lookAt(this.scene.position);
    }
};

App.OrbitControl.prototype.reset = function () {
    this.kx = (!this.options.disableHorizontal ? this.camera.position.z / window.innerWidth : 0);
    this.ky = (!this.options.disableVertical ? this.camera.position.z / window.innerHeight : 0);
};

App.OrbitControl.prototype.onResize = function () {
    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;
};

App.OrbitControl.prototype.onDocumentMouseMove = function (event) {
    this.mouseX = event.clientX - this.windowHalfX;
    this.mouseY = event.clientY - this.windowHalfY;
    this.updateSpeed();
};

App.OrbitControl.prototype.onDocumentTouchStart = function (event) {
    if (event.touches.length > 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
        this.updateSpeed();
    }
};

App.OrbitControl.prototype.onDocumentTouchMove = function (event) {
    if (event.touches.length == 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
        this.updateSpeed();
    }
};

App.OrbitControl.prototype.reset = function() {
    this.scale = this.camera.position.z;
};

App.OrbitControl.prototype.updateSpeed = function() {
    this.speedX = this.mouseX / this.windowHalfX * this.options.orbitSpeed;
    this.speedY = this.mouseY / this.windowHalfY * this.options.orbitSpeed;

    // this.speedX = (!this.options.disableHorizontal ? this.mouseX / this.windowHalfX * this.options.orbitSpeed : 0);
    // this.speedY = (!this.options.disableVertical ? this.mouseY / this.windowHalfY * this.options.orbitSpeed : 0);
};

App.ClickControl = function (canvas, objects, camera, controls) {
    this.startAnimation = TWEEN.Easing.Linear.None;
    this.endAnimation = TWEEN.Easing.Quadratic.Out;
    this.maxAllowedDistance = 5; // Если при клике мышка сдвинута больше чем на
                                 // maxAllowedDistance пикселей, то не выполнять клик

    // Принимаем переданные аргументы
    this.element = canvas;
    this.objects = objects; // Объекты на сцене, которые можно кликать
    this.camera = camera;
    this.controls = controls;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.enabled = true; // Блокировщик открытия сразу нескольких изображений

    this.element.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    this.element.addEventListener('mouseup', this.onMouseUp.bind(this), false);
};

App.ClickControl.prototype = {
    "onMouseDown": function (event) {
        // Не совсем те данные в this.mouse, которые нужны, но на этапе нажатия
        // на кнопку мыши нужно где-то запомнить позицию при начале клика
        var obj = this.element.getBoundingClientRect();

        var clientX = obj.left;
        var clientY = obj.top;

        clientX = event.clientX - clientX;
        clientY = event.clientY - clientY;

        this.mouse.x = clientX;
        this.mouse.y = clientY;
    },

    "onMouseUp": function (event) {
        var obj = this.element.getBoundingClientRect();

        // Смотрим, на сколько сдвинута мышка
        var clientX = obj.left;
        var clientY = obj.top;

        clientX = event.clientX - clientX;
        clientY = event.clientY - clientY;

        var distanceX = Math.abs(clientX - this.mouse.x);
        var distanceY = Math.abs(clientY - this.mouse.y);
        var maxDistance = Math.max(distanceX, distanceY);

        // Если не превышена дистанция, то выполняем клик
        if (maxDistance <= this.maxAllowedDistance) {
            // Заполняем this.mouse правильными данными
            this.mouse.x = (clientX / this.element.clientWidth) * 2 - 1;
            this.mouse.y = (clientY / this.element.clientHeight) * 2 - 1;
            this.mouse.y *= -1; // Исправляем направление оси Y

            // Ищем нажатый элемент
            this.raycaster.setFromCamera(this.mouse, this.camera);
            var intersects = this.raycaster.intersectObjects(this.objects);
            if (intersects.length > 0) {
                this.clicked(intersects, event.which);
            }
        }
    },

    "clicked": function (intersects, mouseKey) {
            // Показываем анимацию увеличения/уменьшения картинки
            var object = intersects[0].object;
            var zoomIn = (!object.hasOwnProperty('zoomed') || !object.zoomed);

            // Не увеличиваем картинки, пока открыта другая
            if (zoomIn && !this.enabled) {
                return;
            }

            // Останавливаем предыдущие анимации
            if (object.hasOwnProperty('tween')) {
                object.tween.move.stop();
                object.tween.rotate.stop();
            } else {
                object.tween = {};
            }

            // Создаём заготовку для анимирования перемещения
            var moveTween = new TWEEN.Tween({
                "x": object.position.x,
                "y": object.position.y,
                "z": object.position.z
            });
            moveTween.onUpdate(function () {
                object.position.copy(this);
            });

            // Создаём заготовку для анимирования кручения
            var rotateTween = new TWEEN.Tween({
                "x": object.quaternion.x,
                "y": object.quaternion.y,
                "z": object.quaternion.z,
                "w": object.quaternion.w
            });
            rotateTween.onUpdate(function () {
                object.quaternion.copy(this);
            });

            // Устанавливаем конечную точку
            if (zoomIn) {
                // Увеличиваем картинку
                this.enabled = false;
                this.controls.enabled = false;
                object.zoomed = true;
                // Сохраняем старые данные
                if (!object.hasOwnProperty('origin')) { // Сохраняем только в первый раз;
                                                        // так оригинал никогда не изменится
                    object.origin = {
                        "position": object.position.clone(),
                        "quaternion": object.quaternion.clone()
                    };
                }

                var alpha = this.camera.fov / 2;
                var maximum = 0.6 * App.ctg(alpha);

                var newPosition = this.camera.position.clone();
                var maxSize = this.camera.position.distanceTo(new THREE.Vector3());

                // Расчёт новых позиций изображения, с учётом растояния камеры
                for (var j = 0; j < 3; j++) {
                    var oldValue = newPosition.getComponent(j);
                    newPosition.setComponent(j, oldValue - maximum * oldValue / maxSize);
                }

                // Заканчиваем формирование анимаций
                moveTween.to(newPosition)
                    .easing(this.startAnimation);
                rotateTween.to(this.camera.quaternion.clone())
                    .easing(this.startAnimation);
            } else {
                // Уменьшаем картинку
                this.enabled = true;
                this.controls.enabled = true;
                object.zoomed = false;
                // Заканчиваем формирование анимаций
                moveTween.to(object.origin.position)
                    .easing(this.endAnimation);
                rotateTween.to(object.origin.quaternion)
                    .easing(this.endAnimation);
            }

            // Запускаем анимацию
            object.tween.move = moveTween;
            object.tween.rotate = rotateTween;
            moveTween.start();
            rotateTween.start();
    },

    "setObjects": function (objects) {
        this.objects = objects;
    }
};

App.MixedControl = function (data, options) {
    App.AbstractControl.call(this, options);

    this.camera = data.camera;
    this.scene = data.scene;
    this.mouseX = 0;
    this.mouseY = 0;
    this.enabled = true;

    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;

    this.kx = 0;
    this.angleX = 90;
    this.angleY = 90;

    this.scale = 1;
    this.speedX = 0;
    this.speedY = 0;

    this.teta = 0;
    this.phi = 0;
    this.orbitSpeed = this.options.orbitSpeed;

    document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    document.addEventListener('touchstart', this.onDocumentTouchStart.bind(this));
    document.addEventListener('touchmove', this.onDocumentTouchMove.bind(this));
};

App.MixedControl.prototype = Object.create(App.AbstractControl.prototype);
App.MixedControl.prototype.constructor = App.MixedControl;

App.MixedControl.prototype.DEFAULTS = {
    "orbitSpeed": 1
};

App.MixedControl.prototype.update = function() {
    if (this.enabled) {

        this.angleX -= this.speedX; // Угол по X
        this.angleY += this.speedY; // Угол по Y

        // Ограничение по Y
        this.angleY = Math.max(1, Math.min(this.angleY, 179));

        this.phi = THREE.Math.degToRad(this.angleX); // Вычисляем азимутальный угол
        this.teta = THREE.Math.degToRad(this.angleY); // Вычисляем зенитный угол



        this.camera.position.x = Math.sin(this.teta) * Math.cos(this.phi) * this.scale;
        this.camera.position.z = Math.sin(this.teta) * Math.sin(this.phi) * this.scale;
        this.camera.position.y += (-this.mouseY * 2.5 - this.camera.position.y / this.ky) * this.ky * 0.05;



        this.camera.lookAt(this.scene.position);
    }

};

App.MixedControl.prototype.onResize = function () {
    this.windowHalfX = window.innerWidth / 2;
    this.windowHalfY = window.innerHeight / 2;
};

App.MixedControl.prototype.onDocumentMouseMove = function (event) {
    this.mouseX = event.clientX - this.windowHalfX;
    this.mouseY = event.clientY - this.windowHalfY;
    this.updateSpeed();
};

App.MixedControl.prototype.onDocumentTouchStart = function (event) {
    if (event.touches.length > 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
        this.updateSpeed();
    }
};

App.MixedControl.prototype.onDocumentTouchMove = function (event) {
    if (event.touches.length == 1) {
        event.preventDefault();
        this.mouseX = event.touches[0].pageX - this.windowHalfX;
        this.mouseY = event.touches[0].pageY - this.windowHalfY;
        this.updateSpeed();
    }
};

App.MixedControl.prototype.reset = function() {
    this.scale = this.camera.position.z + 2;
    this.ky = this.camera.position.z / window.innerHeight;
};

App.MixedControl.prototype.updateSpeed = function() {
    this.kx = this.mouseX / this.windowHalfX;
    this.orbitSpeed = Math.abs(this.options.orbitSpeed * this.kx * 3);
    this.speedX = (!this.options.disableHorizontal ? this.kx * this.orbitSpeed : 0);
};

"use strict";

App.LayoutFactory = function(type, resources, options) {
    var layoutName = App.ucfirst(type) + 'Layout';
    if (App.hasOwnProperty(layoutName)) {
        return new App[layoutName](resources, options);
    } else {
        return new App.Layout(resources, options);
    }
}

// Класс App.Layout - базовый класс для всех Layout'ов
App.Layout = function (resources, options) {
    // Готовим опции layout'а
    this.options = {};
    if (typeof options != 'undefined') {
        App.extend(this.options, this.DEFAULTS, options);
    } else {
        App.extend(this.options, this.DEFAULTS);
    }
    this.validateOptions();

    // this.size - размер сцены после добавления всех объектов
    this.size = new THREE.Vector3(1, 1, 0);
    this.cameraFor = 'undefined'; // "undefined"|"polyhedron"

    // Подготовим нужные параметры перед созданием layout'ов
    if (typeof resources == 'undefined' || resources === null) {
        resources = [];
    }
    this.raw = this.prepare(resources);

    // this.layouts - одномерный массив объектов:
    //     {"resource": ..., "position": ..., "lookAt": ...}
    this.layouts = this.build(resources, this.raw);
};

// Определяем базовые методы
App.Layout.prototype = {
    // SphereLayout, HelixLayout и TriangleLayout имеют свои собственные DEFAULTS
    "DEFAULTS": {
        "margin": 0.5,
        "border": 0.5
    },

    "validateOptions": function () {},

    "prepare": function (resources) {
        return {};
    },

    "build": function (resources, raw) {
        // Просто выставим всем объектам позицию - [0, 0, 0]. Конкретные
        // значения должны проставлять наследующие классы
        var layouts = [];
        for (var i = 0, count = resources.length; i < count; i += 1) {
            layouts.push(this.createLayout(resources[i], 0, 0, 0));
        }
        return layouts;
    },

    "createLayout": function (resource, x, y, z, lx, ly, lz) {
        var position = new THREE.Vector3(x, y, z);
        var look = (typeof lz != 'undefined' ? new THREE.Vector3(lx, ly, lz) : null);
        return {
            "resource": resource,
            "position": position,
            "lookAt": look
        };
    },

    "getLayouts": function () {
        return this.layouts;
    },

    "getRaw": function () {
        return this.raw;
    },

    "getSize": function () {
        return this.size;
    },

    "center": function () {
        var count = this.layouts.length;

        // Находим максимальные и минимальные значения по всем осям
        var min = new THREE.Vector3(Infinity, Infinity, Infinity);
        var max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        for (var i = 0; i < count; i += 1) {
            var position = this.layouts[i].position;
            min.min(position);
            max.max(position);
        }

        // Находим половину расстояния между максимальными и минимальными значениями
        var half = new THREE.Vector3(max.x - min.x, max.y - min.y, max.z - min.z);
        half.divideScalar(2);

        // Определяем сдвиг
        var offset = new THREE.Vector3(0, 0, 0);
        for (var comp/*component*/ = 0; comp < 3; comp += 1) {
            if (max[comp] >= 0) {
                offset.setComponent(comp, max.getComponent(comp) - half.getComponent(comp));
            } else {
                offset.setComponent(comp, min.getComponent(comp) + half.getComponent(comp));
            }
        }

        // Сдвигаем все позиции
        if (offset.x != 0 || offset.y != 0 || offset.z != 0) {
            for (var i = 0; i < count; i += 1) {
                this.layouts[i].position.sub(offset);
            }
        }

        return this;
    },

    "flip": function (x, y, z) {
        // Меняем оси между собой
        for (var i = 0, count = this.layouts.length; i < count; i += 1) {
            var position = this.layouts[i].position;
            position.set(position[x], position[y], position[z]);
        }
        this.center();
        return this;
    },

    "move": function (x, y, z) {
        // Сдвигаем элементы
        var addition = new THREE.Vector3(x, y, z);
        for (var i = 0, count = this.layouts.length; i < count; i += 1) {
            var position = this.layouts[i].position;
            position.add(addition);
        }
        return this;
    },

    "multiply": function (x, y, z) {
        var multiplier = new THREE.Vector3(x, y, z);
        for (var i = 0, count = this.layouts.length; i < count; i += 1) {
            var position = this.layouts[i].position;
            position.multiply(multiplier);
        }
        return this;
    },

    /**
     * Не рекомендуется вызывать этот метод больше одного раза; в таких случаях
     * лучше использовать метод rotate().
     *
     * Поворот всей фигуры вокруг выбраной оси.
     */
    "rotateAxis": function (axis, angle) {
        // Определяем, с какими двумя другими осями будем работать
        var axis1 = 'x', axis2 = 'z'; // Дефолтные значения при axis = "y"
        switch (axis.toLowerCase()) {
            case 'x':
                axis1 = 'y'; axis2 = 'z';
                break;
            case 'z':
                axis1 = 'y'; axis2 = 'x';
                break;
            case 'y':
                angle = -angle; // Меняем угол на противоположный, чтоб получить
                                // вращение против часовой стрелки
                break;
        }
        this.rotateAxes(axis1, axis2, angle);
        this.center();
        return this;
    },

    /**
     * Не рекомендуется вызывать этот [служебный] метод вручную или больше
     * одного раза.
     *
     * Выполняет поворот всей фигуры по двум осям.
     */
    "rotateAxes": function (axis1, axis2, angle) {
        // Считаем за центр точку O'[0; 0]. Если фигура симметрична, то точка O'
        // - центр фигуры. Иначе всё равно поворачиваем фигуру вокруг O'
        for (var i = 0, count = this.layouts.length; i < count; i += 1) {
            var position = this.layouts[i].position;
            var new_position = App.rotatePolar(position[axis1], position[axis2], angle);
            position[axis1] = new_position.x;
            position[axis2] = new_position.y;
        }
        return this;
    },

    /**
     * Выполняет поворот по двум углам: зенитному (dtheta) и азимутальному
     * (dphi).
     */
    "rotate": function (dtheta, dphi) {
        if (dtheta != 0 && dphi != 0) {
            this.rotateAxes('y', 'z', dtheta);
            this.rotateAxes('z', 'x', -dphi);
        } else if (dphi != 0) {
            this.rotateAxes('x', 'z', dphi);
        } else if (dtheta != 0) {
            this.rotateAxes('y', 'z', dtheta);
        }
        this.center();
        return this;
    },

    /**
     * @param {Function} callback 1-й параметр - объект-layout; 2-й - порядковый
     * номер (начиная с 0); 3-й - массив всех layout'ов, this - объект-layout
     * (он же из первого параметра). Если функция возвращает значение
     * <b>false</b>, то цикл прекратит работу.
     * @param {Number} start Не обязательный параметр. Номер, с которого стоит
     * начать обход элементов.
     */
    "each": function (callback, start) {
        if (typeof start == 'undefined') {
            start = 0;
        }
        for (var i = start, count = this.layouts.length; i < count; i += 1) {
            var layout = this.layouts[i];
            var response = callback.call(layout, layout, i, this.layouts);
            if (response === false) {
                break;
            }
        }
        return this;
    }
};

// Класс App.GridLayout
App.GridLayout = function (resources, options) {
    App.Layout.apply(this, arguments);
};

// Наследуем App.GridLayout от App.Layout
App.GridLayout.prototype = Object.create(App.Layout.prototype);
App.GridLayout.prototype.constructor = App.GridLayout;

App.GridLayout.prototype.DEFAULTS = {
    "margin": 0.5,
    "border": 0.5,
    "aspectRatio": 1
};

// Переопределяем базовые методы
App.GridLayout.prototype.prepare = function (resources) {
    var count = resources.length;
    var aspect_ratio = this.options.aspectRatio;

    // Определяем количество строк и колонок
    var rows = Math.sqrt(count / aspect_ratio);
    var cols = rows * aspect_ratio;

    rows = Math.ceil(rows);
    cols = Math.floor(cols);

    // Если что-то осталось, то добавляем ещё 1 колонку
    var left = count - rows * cols;
    if (left > 0) {
        if (aspect_ratio >= 1) {
            cols += 1;
        } else {
            rows += 1;
        }
    }

    return {"rows": rows, "cols": cols};
};

App.GridLayout.prototype.build = function (resources, raw) {
    var layouts = [];
    var count = resources.length;
    var margin = this.options.margin;

    var rows = raw.rows;
    var cols = raw.cols;
    var width = cols + (cols - 1) * margin;
    var height = rows + (rows - 1) * margin;
    var dx = 1 + margin; // 1 - размер объекта + отступ между объектами
    var dy = 1 + margin;
    var x0 = -width / 2 + 0.5; // Левый край + половина размера объекта
    var y0 = height / 2 - 0.5; // Верхний край + половина размера объекта
    var x = x0;
    var y = y0;

    // Обновляем size-параметры
    this.size.x = width;
    this.size.y = height;

    // Выставляем объекты (сначала полностью заполненные строки)
    var next = 0; // current_resource_no
    var fullRows = rows - 1;
    for (var i = 0; i < fullRows; i += 1) {
        x = x0;
        for (var j = 0; j < cols; j += 1) {
            var resource = resources[next];
            var newLayout = this.createLayout(resource, x, y, 0, x, y, 0);
            layouts.push(newLayout);
            x += dx;
            next += 1;
        }
        y -= dy;
    }

    // Последняя строка (возможно - не полная)
    x = x0;
    for (var j = 0, left = Math.min(count - next, cols); j < left; j += 1) {
        var resource = resources[next];
        var newLayout = this.createLayout(resource, x, y, 0, x, y, 0);
        layouts.push(newLayout);
        x += dx;
        next += 1;
    }

    return layouts;
}

// Класс App.TriangleLayout. Формирует именно правильные треугольники, у
// которого все стороны равны
App.TriangleLayout = function (resources, options) {
    // Вызываем конструктор родителя
    App.Layout.apply(this, arguments);
};

// Наследуем App.TriangleLayout от App.Layout
App.TriangleLayout.prototype = Object.create(App.Layout.prototype);
App.TriangleLayout.prototype.constructor = App.TriangleLayout;

App.TriangleLayout.prototype.DEFAULTS = {
    "margin": 0.5,
    "border": 0.5,
    "cutExcess": false
};

App.TriangleLayout.prototype.prepare = function (resources) {
    var count = resources.length;

    // Подсчитываем количество строк
    var maxCapacity = 0;
    var sideLength = 0; // Оно же - и количество строк
    while (maxCapacity < count) {
        sideLength += 1;
        maxCapacity += sideLength;
    }

    // Если нужно (с опций), то отсекаем не полную строку
    if (maxCapacity > count && this.options.cutExcess) {
        maxCapacity -= sideLength;
        sideLength -= 1;
    }

    return {
        "linesCount": sideLength,
        "sideLength": sideLength,
        "capacity": Math.min(count, maxCapacity) // Реальное итоговое количество элементов в layout'е
    };
};

App.TriangleLayout.prototype.build = function (resources, raw) {
    var layouts = [];
    var count = raw.capacity;
    var margin = this.options.margin;
    var linesCount = raw.linesCount;

    var height = linesCount + (linesCount - 1) * margin;
    // Высота правильного треугольника считается по формуле:
    //     h = 3^0.5 / 2 * a
    // Тогда:
    //     a = 2h / 3^0.5
    var width = height * 2 / Math.sqrt(3);

    this.raw.a = width;
    this.raw.h = height;
    this.size.x = width;
    this.size.y = height;

    var dy = 1 + margin; // 1 - размер объекта + отступ между объектами
    var dx = dy * 2 / Math.sqrt(3); // Делаем аналогично width
    var y = height / 2 + 0.5; // Верхний край + половина размера объекта
    var x = 0; // Настоящее значение будем считать на каждом шаге цикла

    // Добавляем "полные" строки, где присутствуют все элементы
    var next = 0; // currentResourceNo
    var fullRows = linesCount - 1;
    for (var i = 0; i < fullRows; i += 1) {
        x = 0 - dx * i / 2;
        next = this.createPack(layouts, resources, next, i + 1, x, y, 0, dx);
        y -= dy;
    }

    // Добавляем последнюю строку
    var lastSideSize = count - next;
    x = 0 - dx * (lastSideSize - 1) / 2;
    this.createPack(layouts, resources, next, lastSideSize, x, y, 0, dx);

    return layouts;
};

App.TriangleLayout.prototype.createPack = function (layouts, resources, currentResourceNo, count, x, y, z, dx) {
    var next = currentResourceNo;
    for (var j = 0; j < count; j += 1) {
        var resource = resources[next];
        var newLayout = this.createLayout(resource, x, y, z);
        layouts.push(newLayout);
        x += dx;
        next += 1;
    }
    return next;
};

// Класс App.TetrahedronLayout
App.TetrahedronLayout = function (resources, options) {
    // Вызываем конструктор родителя
    App.Layout.apply(this, arguments);
    this.cameraFor = 'polyhedron';
};

// Наследуем App.TetrahedronLayout от App.Layout
App.TetrahedronLayout.prototype = Object.create(App.Layout.prototype);
App.TetrahedronLayout.prototype.constructor = App.TetrahedronLayout;

App.TetrahedronLayout.prototype.prepare = function (resources) {
    var imagesPerFace = Math.floor(resources.length / 4);
    return {"imagesPerFace": imagesPerFace};
};

App.TetrahedronLayout.prototype.build = function (resources, raw) {
    var layouts = [];
    var size = raw.imagesPerFace;
    var faceOptions = {"cutExcess": true};

    // Нижняя грань
    var downFaceResources = resources.slice(0, size); // (i * size, (i + 1) * size)
    var downFace = new App.TriangleLayout(downFaceResources, faceOptions);

    // По первой же грани определяем размер тетраэдра
    var a = downFace.raw.a; // Размер стороны тетраэдра (одинаковый для всех граней)
    var h = Math.sqrt(2 / 3) * a; // Высота тетраэдра
    var th = downFace.raw.h; // "Triangles's h"
    var tr = Math.sqrt(3) / 6 * a; // "Triangles's r"

    // Заканчиваем с нижней гранью
    downFace.flip('x', 'z', 'y').move(0, -h / 2, 0);
    downFace.each(function (layout) {
        var position = layout.position;
        // Элементы граней смотрят вниз (-Y)
        layout.lookAt = new THREE.Vector3(position.x, position.y - 1, position.z);
    });
    layouts = layouts.concat(downFace.getLayouts());

    // Задняя грань
    var backFaceResources = resources.slice(size, size * 2); // (i * size, (i + 1) * size)
    var backFace = new App.TriangleLayout(backFaceResources, faceOptions);
    backFace.rotate(-19.47, 0).move(0, 0, -tr);
    backFace.each(function (layout) {
        // Тут и для следующих граней будут использоваться определённые смещения
        // от позиций, чтоб создать точку для "lookAt" (точку, в которую будет
        // смотреть каждый элемент грани). Метод их получения (все углы указаны
        // в градусах):
        //     0.3333 - sin(19.47) - 90 минус угод между гранями тетраэдра (70.53)
        //     0.9428 - cos(19.47) - 90 минус угод между гранями тертаэдра (70.53)
        //     0.866 - sin(60) - угол поворота левой и правой граней (см. rotate(..., +-60))
        //     0.5 - cos(60) - угол поворота левой и правой граней (см. rotate(..., +-60))
        var position = layout.position;
        layout.lookAt = new THREE.Vector3(position.x, position.y + 0.3333, position.z - 0.9428);
    });
    layouts = layouts.concat(backFace.getLayouts());

    // Левая грань
    var leftFaceResources = resources.slice(size * 2, size * 3); // (i * size, (i + 1) * size)
    var leftFace = new App.TriangleLayout(leftFaceResources, faceOptions);
    leftFace.rotate(19.47, -60).move(-a / 4, 0, 0);
    leftFace.each(function (layout) {
        var position = layout.position;
        layout.lookAt = new THREE.Vector3(position.x + 0.866, position.y - 0.3333, position.z - 0.5);
    });
    layouts = layouts.concat(leftFace.getLayouts());

    // Правая грань
    var rightFaceResources = resources.slice(size * 3, size * 4); // (i * size, (i + 1) * size)
    var rightFace = new App.TriangleLayout(rightFaceResources, faceOptions);
    rightFace.rotate(19.47, 60).move(a / 4, 0, 0);
    rightFace.each(function (layout) {
        var position = layout.position;
        layout.lookAt = new THREE.Vector3(position.x - 0.866, position.y - 0.3333, position.z - 0.5);
    });
    layouts = layouts.concat(rightFace.getLayouts());

    // Обновляем размеры фигуры и margin
    this.size.x = a;
    this.size.z = th;
    this.size.y = h;

    return layouts;
};

// Класс App.SphereLayout
App.SphereLayout = function (resources, options) {
    // Вызываем конструктор родителя
    App.Layout.apply(this, arguments);
};

// Наследуем App.SphereLayout от App.Layout
App.SphereLayout.prototype = Object.create(App.Layout.prototype);
App.SphereLayout.prototype.constructor = App.SphereLayout;

App.SphereLayout.prototype.DEFAULTS = {
    "margin": 0.5,
    "border": 2.5
};

App.SphereLayout.prototype.prepare = function (resources) {
    var count = resources.length;

    // Приблизительно считаем радиус сферы
    // S = 4/3 * Pi * R^3
    // Допустим, S = count * Pi
    // R^3 = S * 0.75 / Pi = count * 0.75
    var radius = count * 0.75;
    // R = (...)^0.333
    radius = Math.pow(radius, 0.333);

    // Устанавливаем все size
    var diameter = radius * 2;

    this.size.x = diameter;
    this.size.y = diameter;
    this.size.z = diameter;

    if (this.options.border == this.DEFAULTS.border) {
        // Правим дефолтный border
        this.options.border = radius / this.options.border;
    }

    // Возвращаем группы
    return {"radius": radius, "diameter": diameter};
};

// Переопределяем базовые методы
App.SphereLayout.prototype.build = function (resources, raw) {
    var layouts = [];
    var count = resources.length;
    var radius = raw.radius;

    if (count > 0) {
        var dphi = 2 / (count + 1);
        var phiCurr = -1;
        for (var i = 0; i < count; i += 1) {
            phiCurr += dphi;

            var phi = Math.acos(phiCurr);
            var theta = Math.sqrt(count * Math.PI) * phi;

            var x = Math.cos(theta) * Math.sin(phi) * radius;
            var y = Math.sin(theta) * Math.sin(phi) * radius;
            var z = Math.cos(phi) * radius;

            layouts.push(this.createLayout(resources[i], y, z, x, 0, 0, 0));
        }
    }

    return layouts;
}

// Класс App.HelixLayout
App.HelixLayout = function () {
    App.Layout.apply(this, arguments);
};

// Наследуем App.HelixLayout от App.Layout
App.HelixLayout.prototype = Object.create(App.Layout.prototype);
App.HelixLayout.prototype.constructor = App.HelixLayout;

App.HelixLayout.prototype.DEFAULTS = {
    "margin": 0.3,
    "border": 3
};

App.HelixLayout.prototype.prepare = function (resources) {
    var count = resources.length;
    var circlesCount = Math.max(count / 50, 3);
    var imagesCount = count / circlesCount;

    // Расчёт длины окружности
    var c = (1 + this.options.margin) * imagesCount;

    // Расчёт диаметра
    var diameter = c / Math.PI;

    this.size.x = diameter;
    this.size.y = circlesCount + 1 + ((circlesCount - 2) * this.options.margin);
    this.size.z = diameter;

    // Возвращаем группы
    return {"circlesCount": circlesCount, "imagesPerCircle": imagesCount, "diameter": diameter};
};

App.HelixLayout.prototype.build = function (resources, raw) {
    var layouts = [];
    var count = resources.length;
    var circlesCount = raw.circlesCount;
    var radius = raw.diameter / 2;
    var height = this.size.y;

    if (count > 0) {
        for (var i = 0; i < count; i += 1) {
            var phi = (circlesCount * 360 / count * i) * Math.PI / 180;
            var x = radius * Math.cos( phi );
            var y = height / count * i  - (height / 2);
            var z = radius * Math.sin( phi );

            layouts.push(this.createLayout(resources[i], x, y, z, 0, y, 0));
        }
    }

    return layouts;
}

// Класс App.CubeLayout
App.CubeLayout = function () {
    App.Layout.apply(this, arguments);
    this.cameraFor = "polyhedron";
};

// Наследуем App.CubeLayout от App.Layout
App.CubeLayout.prototype = Object.create(App.Layout.prototype);
App.CubeLayout.prototype.constructor = App.CubeLayout;

App.CubeLayout.prototype.prepare = function(resources) {
    var count = resources.length;
    var faceCount = 4; // Количество граней
    var imagesPerFace = Math.ceil(count / faceCount); // Количество изображений на одной грани куба

    var side = Math.sqrt(imagesPerFace);
    var rows = Math.floor(side);
    var cols = Math.floor(imagesPerFace / rows);

    var left = imagesPerFace - rows * cols;
    imagesPerFace -= left; // Убираем лишние изображения

    return {'imagesPerFace': imagesPerFace, 'faceCount': faceCount, 'cols': cols, 'rows': rows};
};

App.CubeLayout.prototype.build = function(resources, raw) {
    var layouts = [];

    // Массив поворотов граней
    var rotations = [
        { "x": "x", "y": "y", "z": "z" }, // front
        { "x": "x", "y": "y", "z": "z" }, // back
        { "x": "z", "y": "y", "z": "x" }, // left
        { "x": "z", "y": "y", "z": "x" }, // right
        { "x": "y", "y": "z", "z": "x" }, // top
        { "x": "y", "y": "z", "z": "x" }, // bottom
    ];

    // Коеффициент смещений граней по осям
    var radius = raw.cols * 0.75 + 0.25;
    var verticalRadius = raw.rows * 0.75 + 0.25;

    // Массив смещений граней по осям
    var offsets = [
        { "x": 0, "y": 0, "z": radius },  // front
        { "x": 0, "y": 0, "z": -radius }, // back
        { "x": -radius, "y": 0, "z": 0 }, // left
        { "x": radius, "y": 0, "z": 0 },  // right
        { "x": 0, "y": verticalRadius, "z": 0 },  // top
        { "x": 0, "y": -verticalRadius, "z": 0 }, // bottom
    ];

    // Массив множителей векторов lookAt
    var lookAtFaces = [
        new THREE.Vector3(1, 1, 2),
        new THREE.Vector3(1, 1, 2),
        new THREE.Vector3(2, 1, 1),
        new THREE.Vector3(2, 1, 1),
        new THREE.Vector3(1, 2, 1),
        new THREE.Vector3(1, 2, 1),
    ];

    var width = raw.cols + (raw.cols - 1) / 2;
    var height = raw.rows + (raw.rows - 1) / 2;

    // Обновляем size-параметры
    this.size.x = width;
    this.size.y = height;
    this.size.z = radius * 2;

    // Выставляем объекты
    for (var i = 0; i < raw.faceCount; i += 1) {
        var faceSize = raw.imagesPerFace;
        var faceRotation = rotations[i];
        var faceOffset = offsets[i];
        var lookAtFace = lookAtFaces[i];
        var faceResources = resources.slice(i * faceSize, (i + 1) * faceSize);

        // Создаём новую грань
        var face = new App.GridLayout(faceResources);

        // Поворачиваем грань
        face.flip(faceRotation.x, faceRotation.y, faceRotation.z);

        var faceLayouts = face.layouts;
        for (var j = 0, len = faceLayouts.length; j < len; j += 1) {
            var layout = faceLayouts[j];

            layout.position.add(faceOffset);
            layout.lookAt = layout.position.clone();
            layout.lookAt.multiply(lookAtFace);

            layouts.push(layout);
        }
    }

    return layouts;
}

"use strict";

App.PainterFactory = function(type, options) {
    var layoutName = App.ucfirst(type) + 'Painter';
    if (App.hasOwnProperty(layoutName)) {
        return new App[layoutName](options);
    } else {
        return new App.Painter(options);
    }
};

// Класс App.Painter - базовый класс для всех Painter'ов
App.Painter = function (options) {
    // Готовим опции painter'а
    this.options = {};
    if (typeof options != 'undefined') {
        App.extend(this.options, this.DEFAULTS, options);
    } else {
        App.extend(this.options, this.DEFAULTS);
    }
    this.validateOptions();
};

// Определяем базовые методы
App.Painter.prototype = {
    "DEFAULTS": {
        "fitHeightOnly": false
    },

    "validateOptions": function () {},

    /**
     * Метод ничего не сохраняет, только выводит объекты на экран.
     */
    "paint": function (context) {


        // layoutManager, scene, camera
        var layouts = context.layout.getLayouts();
        var objects = [];

        // Обходим все layout'ы
        for (var i = 0, len = layouts.length; i < len; i += 1) {
            var layout = layouts[i];
            var geometry = this.createGeometry(layout.resource);
            var material = this.createMaterial(layout.resource);
            var object = this.createObject(geometry, material, layout);

            object.resource = layout.resource;
            // Выставляем объект в нужную позицию
            object.position.copy(layout.position);
            // Меняем угол объекта
            if (layout.lookAt !== null) {
                object.lookAt(layout.lookAt);
            }

            object.truePosition = object.position.clone();

            if(context.options.animate){
                object.position.y =  35;
                object.position.x = 0;
                object.position.z = 0;
            }

            // Объект готов к добавлению на сцену
            context.scene.add(object);
            objects.push(object);
        }

        // Меняем позицию камеры
        var size = context.layout.getSize().clone(); // Клонируем, потому что нужно будет добавить border'ы
        size.addScalar(context.layout.options.border * 2); // По одному border'у с каждой стороны
        var cameraFor = context.layout.cameraFor;
        this.moveCamera(context.camera, size, cameraFor);

        return objects;
    },

    "createGeometry": function (resource) {
        return null;
    },

    "createMaterial": function (resource) {
        var materialProperties = {
            "color": 0xffffff
        };

        if (App.IS_WEBGL_RENDERER) {
            return new THREE.SpriteMaterial(materialProperties);
        } else {
            materialProperties.program = function(context) {
                context.beginPath();
                context.arc(
                    0, // X-координата центра круга
                    0, // Y-координата центра круга
                    0.5, // Радиус круга
                    0, // Стартовый угол
                    App.PI2, // Конечный угол
                    false // "По часовой стрелке"
                );
                context.fill();
            };
            return new THREE.SpriteCanvasMaterial(materialProperties);
        }
    },

    "createObject": function (geometry, material, layout) {
        return new THREE.Sprite(material);
    },

    "moveCamera": function (camera, size, cameraFor) {
        var sizes = [size.x, size.y, size.z];

        var maxSize = size.y;
        if (!this.options.fitHeightOnly) {
            var maxSize = Math.max.apply(null, sizes);
        }

        var radius = maxSize / 2;
        var alpha = camera.fov / 2;
        var camera_distance = radius * App.ctg(alpha);

        if (cameraFor === 'polyhedron') {
            // Находим вторую по величине сторону
            sizes.splice(sizes.indexOf(maxSize), 1);
            var secondMax = Math.max.apply(null, sizes);
            // Отводим камеру ещё дальше
            camera_distance += secondMax / 2;
        }

        camera.position.z = camera_distance;
    }

};

// Класс App.ImagePainter
App.ImagePainter = function (options) {
    // Вызываем конструктор родителя
    App.Painter.apply(this, arguments);
};

// Наследуем App.ImagePainter от App.Painter
App.ImagePainter.prototype = Object.create(App.Painter.prototype);
App.ImagePainter.prototype.constructor = App.ImagePainter;

// Переопределяем базовые методы
App.ImagePainter.prototype.createGeometry = function (resource) {
    return new THREE.PlaneGeometry(1, 1);
};

App.ImagePainter.prototype.createMaterial = function (resource) {
    var texture = App.loadTexture(resource);
    return new THREE.MeshBasicMaterial({
        "map": texture,
        "side": THREE.DoubleSide,
    });
};

App.ImagePainter.prototype.createObject = function (geometry, material, layout) {
    return new THREE.Mesh(geometry, material);
};

// Класс App.TrianglePainter
App.TrianglePainter = function (options) {
    // Вызываем конструктор родителя
    App.ImagePainter.apply(this, arguments);
};

// Наследуем App.TrianglePainter от App.ImagePainter
App.TrianglePainter.prototype = Object.create(App.ImagePainter.prototype);
App.TrianglePainter.prototype.constructor = App.TrianglePainter;

// Переопределяем базовые методы
App.TrianglePainter.prototype.createGeometry = function (resource) {
    var shape = new THREE.Shape();

    // Создаём треугольную форму (равносторонний треугольник по центру квадрата 1x1)
    shape.moveTo(0, 0.067);
    shape.lineTo(0.5, 0.933);
    shape.lineTo(1, 0.067);
    shape.lineTo(0, 0.067);

    var geometry = shape.makeGeometry();

    // Сдвигаем геометрию (выставляем по ценру)
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(-0.5, -0.5, 0));

    return geometry;
};

// Класс App.SlicePainter
App.SlicePainter = function (options) {
    App.ImagePainter.call(this, options);
};

// Наследуем App.SlicePainter от App.ImagePainter
App.SlicePainter.prototype = Object.create(App.ImagePainter.prototype);
App.SlicePainter.prototype.constructor = App.SlicePainter;

// Переопределяем базовые методы
App.SlicePainter.prototype.paint = function (layoutManager, scene, camera) {
    var size = null;
    if (layoutManager instanceof App.GridLayout) {
        size = layoutManager.getRaw();
    } else {
        var gridLayout = new App.GridLayout();
        size = gridLayout.getRaw();
    }

    this.segmentsX = size.cols;
    this.segmentsY = size.rows;
    this.segmentsCount = size.rows * size.cols;

    this.segment = 0;

    return App.ImagePainter.prototype.paint.apply(this, arguments);
};

App.SlicePainter.prototype.createGeometry = function (resource) {
    // Получаем от папки... PlaneGeometry размером 1x1
    var gem = App.ImagePainter.prototype.createGeometry.call(this, resource);

    var row = this.segmentsY - Math.floor(this.segment / this.segmentsX);
    var col = this.segment % this.segmentsX;

    var uMin = col / this.segmentsX;
    var uMax = (col + 1) / this.segmentsX;
    var vMin = (row - 1) / this.segmentsY;
    var vMax = row / this.segmentsY;

    var segment = [
        new THREE.Vector2(uMin, vMin),
        new THREE.Vector2(uMax, vMin),
        new THREE.Vector2(uMax, vMax),
        new THREE.Vector2(uMin, vMax)
    ];

    gem.faceVertexUvs[0] = [];
    gem.faceVertexUvs[0][0] = [segment[3], segment[0], segment[2]];
    gem.faceVertexUvs[0][1] = [segment[0], segment[1], segment[2]];

    this.segment += 1;

    return gem;
};
