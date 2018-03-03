/**
 * Created by zhangchao on 2018/2/23.
 */
;(function(){
    var ABS = Math.abs;

    /*
     * @param target 绑定元素 支持字符串和HTML对象
     */
    function Gesture(target){
        // 获取目标元素
        this.target = target instanceof HTMLElement ? target :
            typeof  target === 'string' ? document.querySelector(target) : null;
        if(!this.target) return;

        this.touch = {
            startX:0,
            startY:0,
            startTime:0
        }; // 记录刚触摸的手指
        this.movetouch = {}; // 记录移动过程中变化的手指参数
        this.pretouch = {}; // 由于涉及双击，需要一个记录上一次触摸的对象
        this.longTapTimeout = null; // 用于触发长按的定时器
        this.tapTimeout = null; // 用于触发点击的定时器
        this.doubleTap = false; // 用于记录是否执行双击的定时器
        this.handles = {}; // 用于岑芳回调函数的对象

        this._touch = this._touch.bind(this);
        this._move = this._move.bind(this);
        this._end = this._end.bind(this);
        this._cancel = this._cancel.bind(this);

        this.target.addEventListener('touchstart',this._touch,false);
        this.target.addEventListener('touchmove',this._move,false);
        this.target.addEventListener('touchend',this._end,false);
        this.target.addEventListener('touchcancel',this._cancel,false);

    }

    Gesture.prototype = {
        _touch: function(e){
            // this.params.event = e; // 记录触摸时的事件对象，params为回调时的传参
            this.e = e.target; // 触摸的具体元素
            var point = e.touches ? e.touches[0] : e; // 获得触摸参数
            var now = Date.now();  // 当前时间
            this.touch.startX = point.pageX;
            this.touch.startY = point.pageY;
            this.touch.startTime = now;

            // 由于会有多次触摸的情况，单击事件和双击针对单词触摸，先清空定时器
            this.longTapTimeout && clearTimeout(this.longTapTimeout);
            this.tapTimeout && clearTimeout(this.tapTimeout);
            this.doubleTap = false;

            this._emit('touch'); // 执行原生的touchstart回调，
            if(e.touches.length > 1){
                // 多个手指触摸
                var point2 = e.touches[1];
                this.preVector = {
                    x: point2.pageX - this.touch.startX,
                    y: point2.pageY - this.touch.startY
                }
                this.startDistance = calcLen(this.preVector);
                this._emit('multitouch');
            }else{
                var self = this;
                this.longTapTimeout = setTimeout(function(){ // 手指触摸后立即开启长按定时器，800ms后执行
                    self._emit('longtap'); // 执行长按回调
                    self.doubleTap = false;
                    e.preventDefault();
                },800);

                // 按照上面分析的思路计算当前是否处于双击状态
                this.doubleTap = this.pretouch.time
                    && now - this.pretouch.time < 300
                    && ABS(this.touch.startX - this.pretouch.startX) < 30
                    && ABS(this.touch.startY - this.pretouch.startY) < 30
                    && ABS(this.touch.startTime - this.pretouch.time) < 300;
                this.pretouch = { // 更新上一个触摸的信息为当前，供下一次触摸使用
                    startX: this.touch.startX,
                    startY: this.touch.startY,
                    time: this.touch.startTime
                };
            }
        },
        _move: function(e){
            var point = e.touches ? e.touches[0] : e;
            this._emit('move'); //原生的touchmove事件回调
            if(e.touches.length > 1){ // 多个手指触摸

            }else{
                var diffX = point.pageX - this.touch.startX,
                    diffY = point.pageY - this.touch.startY; // 与手指刚触摸时的相对坐标
                this.params.diffY = diffY;
                this.params.diffX = diffX;

                if(this.movetouch.x){ // 记录移动过程中与上一次移动的相对坐标
                    this.params.deltaX = point.pageX - this.movetouch.x;
                    this.params.deltaY = point.pageY - this.movetouch.y;
                }else{
                    this.params.deltaX = this.params.deltaY = 0;
                }
                if(ABS(diffX) > 30 || ABS(diffY) > 30){ // 当手指划过的距离超过30，所有单手指非滑动事件取消
                    this.longTapTimeout && clearTimeout(this.longTapTimeout);
                    this.tapTimeout && clearTimeout(this.tapTimeout);
                    this.doubleTap = false;
                }
                this._emit('slide'); // 执行自定义的move回调

                // 更新移动中的手指参数
                this.movetouch.x = point.pageX;
                this.movetouch.y = point.pageY;
            }
        },
        _end: function(e){
            this.longTapTimeout && clearTimeout(this.longTapTimeout); // 手指离开，取消长按事件
            var timestamp = Date.now();
            var deltaX = ~~((this.movetouch.x || 0) - this.touch.startX),
                deltaY = ~~((this.movetouch.y || 0) - this.touch.startY);
            var direction = '';
            if(this.movetouch.x && (ABS(deltaX) > 30 || this.movetouch.y !== null && ABS(deltaY) > 30)){ // swiper手势
                if(ABS(deltaX) < ABS(deltaY)){
                    if(deltaY < 0){ // 上划
                        this._emit('swipeUp');
                        this.params.direction = 'up';
                    }else{
                        this._emit('swipeDown');
                        this.params.direction = 'down';
                    }
                }else{
                    if(deltaX < 0){ // 左划
                        this._emit('swipeLeft');
                        this.params.direction = 'left';
                    }else{
                        this._emit('swipeRight');
                        this.params.direction = 'right';
                    }
                }
                this._emit('swipe'); // 划
            }else{
                self = this;
                if(!this.doubleTap && timestamp - this.touch.startTime < 300){ // 单次点击300ms内离开，触发点击事件
                    this.tapTimeout = setTimeout(function(){
                        self._emit('tap');
                        self._emit('finish'); // 事件处理完的回调
                    },300)
                }else if(this.doubleTap){ // 300ms内在此点击且离开，则触发双击事件，不触发单击事件
                    this._emit('dbtap');
                    this.tapTimeout && clearTimeout(this.tapTimeout);
                    this._emit('finish')
                }else{
                    this._emit('finish')
                }
            }
            this._emit('finish')
        },
        _cancel: function(e){
            this._emit('cancel');
            this._end();
        },
        _emit: function(type){
            console.log(type)
            !this.handles[type] && (this.handles[type] = []);
            for(var i = 0, len = this.handles[type].length; i < len; i++){
                typeof  this.handles[type][i] === 'function' && this.handles[type][i](this.params)
            }
            return true;
        },
        on: function(type,callback){
            !this.handles[type] && (this.handles[type] = []);
            this.handles[type].push(callback);
            return this;//链式调用
        },
        _init: function(){
            this.touch = {};
            this.movetouch = {};
            this.params = {
                zoom: 1,
                deltaX: 0,
                deltaY: 0,
                diffX: 0,
                diffY: 0,
                angle: 0,
                direction: ''
            }
        }

    };

    Gesture.prototype.constructor = Gesture;

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = Gesture;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return Gesture; });
    } else {
        window.GT = Gesture;
    }
})();