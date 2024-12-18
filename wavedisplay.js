export class WaveDisplay{
    #options = {
        data: [],
        parent: document.body,
        samplesPerPoint: 60,
        sampleRate: 44100,
        zoomRate: 0.01,
        decelerationTime: 4,
        scale:1,
    }
    #parent;
    #svg;
    #data;
    #peaks;
    #samplesPerPixel = 1;
    #startIndex;
    #endIndex;
    #zoom = 1;
    #scrolling = false;
    #lastMoveTime = null;
    #lastMoveX = null;
    #scrollSpeed=0;
    #minValue;
    #maxValue;
    #scrollbar;
    #zoomPinchMode = false;
    #evCache = [];
    #startLeftLock = -1;
    #startRightLock = -1;
    #lockRange = -1;
    #scale = 1;
    #viewBox = {xmin:0, ymin:0, xmax:100, ymax:100};
    constructor(options){
        this.#options = {...this.#options, ...options};
        this.#parent = this.#options.parent;
        this.#data = this.#options.data;
            
        this.#svg = this.#createSVG(this.#options.parent);
        this.#scrollbar = document.createElement('div');
        this.#scrollbar.classList.add('scrollbar');
        this.#scrollbar.appendChild(document.createElement('div'));

        this.#parent.appendChild(this.#scrollbar);

        this.#parent.addEventListener('pointerdown',e =>{        
            if (e.ctrlKey){
                //  create a copy of the event but with a new pointerID
                let ctrlPointer = new PointerEvent('pointerdown',{pointerId:-1, type: e.pointerType, clientX: e.clientX, clientY:e.clientY});
                this.#addEvent(ctrlPointer);
                console.log('ctrlPoint id: '+ctrlPointer.pointerId+' set: ' + ctrlPointer.clientX, 'ctrlPoint');
            } else {
                this.#addEvent(e);
                this.#scrolling = e.target == this.#scrollbar;
                this.#parent.setPointerCapture(e.pointerId);
            }
            this.#scrollSpeed = 0;
            this.#lastMoveX = e.clientX;
        });  

        this.#parent.addEventListener('pointerup',e =>{
            this.#parent.releasePointerCapture(e.pointerId);
            if ( this.#zoomPinchMode || e.timeStamp -  this.#lastMoveTime > 20 ){
                this.#scrollSpeed = 0;
                this.#lastMoveTime = null;
                this.#lastMoveX = null;
                this.#scrolling = false;
            }
            
            if (e.ctrlKey){
                e.preventDefault();
                e.stopPropagation();
            }

            if (this.#scrollSpeed != 0){
                requestAnimationFrame(this.#keepScrolling.bind(this));
            }
            this.#pinchZoomFinished(e);
        });

        this.#parent.addEventListener('pointercancel',e=>{
            this.#pinchZoomFinished(e);
        });

        this.#parent.addEventListener('pointerout',e=>{
            //this.#pinchZoomFinished(e);
        });

        this.#parent.addEventListener('pointerleave',e=>{
            this.#pinchZoomFinished(e);
        });
        
        this.#parent.addEventListener('pointermove',e=>{
            if ( e.buttons==0 || this.#lastMoveX == null){
                return;
            }
            
            // Find this event in the cache and update its record with this event
            const index = this.#evCache.findIndex(
                (cachedEv) => cachedEv.pointerId === e.pointerId
            );           
            this.#evCache[index] = e;

            e.preventDefault(); 
            
            if (this.#evCache.length === 2) {  // Pinch to zoom
                
                let leftPos = Math.min(this.#evCache[0].clientX , this.#evCache[1].clientX);
                let rightPos = Math.max(this.#evCache[0].clientX , this.#evCache[1].clientX);
                if (e.pointerType !='mouse'){
                    leftPos = Math.floor(leftPos / 2) * 2;
                    rightPos = Math.floor(rightPos / 2) * 2;
                }
                if (this.#startLeftLock < 0 || this.#startRightLock < 0){
                    this.#startLeftLock =  this.#startIndex + (this.#samplesPerPixel * leftPos);
                    this.#startRightLock = this.#startIndex + (this.#samplesPerPixel * rightPos);
                    this.#lockRange = this.#startRightLock - this.#startLeftLock;
                    console.log('lock  left: ' + this.#startLeftLock.toFixed(2) + ' right: ' + this.#startRightLock.toFixed(2), 'lockTouch');
                } else {
                    const pixelRange = rightPos - leftPos;
                    let samplesPerPixel = this.#lockRange / pixelRange;
                    console.log('touch left: ' + leftPos.toFixed(0) + ' right: ' + rightPos.toFixed(0), 'touchPos');
                    this.#startIndex = Math.min(this.#data.length, Math.max(0, this.#startLeftLock - (leftPos * samplesPerPixel)));
                    this.#endIndex = Math.min(this.#data.length, Math.max(0, this.#startRightLock + (this.#svg.clientWidth - rightPos) * samplesPerPixel));
                    this.#drawValues(this.#startIndex, this.#endIndex);
                }
            } else if (!this.#zoomPinchMode){   //  Drag

                const walkX = e.clientX - this.#lastMoveX;
                let range = this.#endIndex - this.#startIndex;
                let indexStep;  
                if (this.#scrolling){
                    indexStep = walkX * -(this.#data.length / this.#parent.offsetWidth);
                } else {
                    indexStep = walkX * this.#samplesPerPixel;
                    //  calculate scroll speed
                    if (this.#lastMoveTime != null){
                        this.#scrollSpeed = (e.clientX - this.#lastMoveX);
                        console.log('move interval: ' + (e.timeStamp - this.#lastMoveTime)/1000,'moveInterval');
                        console.log('Scrollspeed: ' + this.#scrollSpeed.toFixed(2),'scrollspeed');
                    }
                }
                this.#startIndex = Math.min(this.#data.length - range, Math.max(0, this.#startIndex - indexStep));
                this.#endIndex = this.#startIndex + range;
                this.#drawValues(this.#startIndex , this.#endIndex );

                this.#lastMoveX = e.clientX;
                this.#lastMoveTime = e.timeStamp;
            }
        });

        this.#parent.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });

        window.addEventListener("resize", (event) => {
            this.#drawValues(this.#startIndex, this.#endIndex);
        });

        this.#init();
    }

    #init(){
        this.#findMinMax();
        this.#setZoom(this.#options.zoom);
        this.#scale = Math.abs(this.#options.scale);
        this.#startIndex = 0;
        this.#endIndex = this.#data.length / this.#zoom;
        let range = this.#endIndex - this.#startIndex;
        this.#samplesPerPixel = range / this.#svg.parentElement.offsetWidth;
        this.#drawValues(this.#startIndex, this.#endIndex);
        console.log('New  samplesPerPixel: ' + this.#samplesPerPixel.toFixed(0), 'newSamplesPerPixel');
        console.log('Total touches: ' + this.#evCache.length, 'cacheSize');
        console.log('Lock  touch init', 'lockTouch');
        console.log('Touch init: ','touchPos');
        console.log('Index start: ' + this.#startIndex.toFixed(2) + ' end: ' + this.#endIndex.toFixed(2), 'indexes');
        console.log('PinchZoom ' + this.#zoomPinchMode, 'pinchZoom');
        console.log('Scrollspeed: ' + this.#scrollSpeed.toFixed(2),'scrollspeed');
        console.log('CacheUpdate init','cacheUpdate');
        console.log('CtrlPoint init', 'ctrlPoint');
    }

    #pinchZoomFinished(e) {
        if (this.#removeEvent(e.pointerId) && this.#zoomPinchMode){
            this.#removeEvent(-1); //  remove fake first point if present
            if (this.#evCache.length == 0){
                this.#zoomPinchMode = false;
                this.#startLeftLock = -1;
                this.#startRightLock = -1;
                console.log('PinchZoom ' + this.#zoomPinchMode, 'pinchZoom');
            }
        }
    }

    #addEvent(e) {
        this.#evCache.push(e);
        this.#zoomPinchMode = this.#evCache.length > 1;
        console.log('Add pointerId: '+e.pointerId+' at clientX: ' + e.clientX.toFixed(0),'cacheUpdate');
        console.log('Total touches: ' + this.#evCache.length, 'cacheSize');
        console.log('PinchZoom ' + this.#zoomPinchMode, 'pinchZoom');
    }

    #removeEvent(pointerId) {
        if (!pointerId || typeof pointerId === 'undefined') return false;
        if (this.#evCache.length === 0) return false;

        const index = this.#evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === pointerId,
          );

          if (index > -1){
            this.#evCache.splice(index, 1);
            console.log('Del pointerId: ' + pointerId, 'cacheUpdate');
            console.log('Total touches: ' + this.#evCache.length, 'cacheSize');
            return true;
        }
        return false;
    }

    #findMinMax() {
        for (let i = 0; i < this.#data.length; i++) {
            let value = this.#data[i];
            this.#minValue = this.#minValue == null? value : Math.min(this.#minValue, value); 
            this.#maxValue = this.#maxValue == null? value : Math.max(this.#maxValue, value);
        }
    }

    #keepScrolling(timeStamp) {
        let totalTime = (timeStamp - this.#lastMoveTime) / 1000;
        let f = 1 - Math.min(1, (totalTime / this.#options.decelerationTime));
        if (f==0 || this.#scrollSpeed ==0){
            this.#scrollSpeed = 0;
            return;
        }
        let indexStep = f*f*this.#scrollSpeed * this.#samplesPerPixel;
        let range = this.#endIndex - this.#startIndex;  
        this.#startIndex = Math.min(this.#data.length - range, Math.max(0, this.#startIndex - indexStep));
        this.#endIndex = this.#startIndex + range;
        this.#drawValues(this.#startIndex , this.#endIndex );
        this.#scrollbar.left = (this.#startIndex / this.#data.length * this.#parent.offsetWidth)+'px';
  
        requestAnimationFrame(this.#keepScrolling.bind(this));
    }

    #createSVG(){
        const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('values-svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M0 0L100 0 100 32 0 32 0 0');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.appendChild(path);
        this.#parent.appendChild(svg);
        return svg;
    }

    #handleWheel(e){
        this.#setZoom(this.#zoom * Math.exp(-e.deltaY / 80 * this.#options.zoomRate));
        let along = e.clientX / this.#svg.clientWidth;
        this.#scrollZoom(this.#zoom, along);
        e.preventDefault();
    }

    #setZoom(value){
        let clampedValue  = Math.min(Math.max(1, value), this.maxZoom);
        if (clampedValue  !== this.#zoom){
            this.#zoom = clampedValue ;
            return true;
        }
        return false;
    }

    #scrollZoom(zoom, along = 0.5){
        let oldRange = this.#endIndex - this.#startIndex;
        let lockIndex = this.#startIndex + (along * oldRange);
        let newRange = this.#data.length / zoom;
        this.#startIndex = Math.max(0, lockIndex - (newRange * along));
        this.#endIndex = Math.min(this.#data.length, (this.#startIndex + newRange));
        this.#drawValues(this.#startIndex, this.#endIndex);
    }

    #setViewBox(xmin, ymin, xmax, ymax){
        this.#viewBox.xmin = xmin!=null? xmin : this.#viewBox.xmin;
        this.#viewBox.ymin = ymin!=null? ymin : this.#viewBox.ymin;
        this.#viewBox.xmax = xmax!=null? xmax : this.#viewBox.xmax;
        this.#viewBox.ymax = ymax!=null? ymax : this.#viewBox.ymax;
        this.#svg.setAttribute('viewBox', this.#viewBox.xmin + ' ' +this.#viewBox.ymin + ' ' +this.#viewBox.xmax + ' ' + this.#viewBox.ymax);
    }

    #getPeaks(startIndex, endIndex, pointCount){
        this.#peaks = [];
        let range = endIndex - startIndex;
        let sampleStep = Math.max(1, (range / pointCount));
        let avgSampleCount = 50;
        startIndex = (startIndex / (sampleStep * 2)) * sampleStep * 2;
        let firstPeakIndex = null;
        for (let i=0; i < pointCount; i++){
            let yMax= 0;
            let sampleCount = Math.min(sampleStep, avgSampleCount);
            let step = Math.max(1,(sampleStep / avgSampleCount));
            for (let j = 0; j < sampleCount; j++){
                let index = ~~(startIndex + (i * sampleStep) + (j*step));
                if (firstPeakIndex==null) firstPeakIndex = index;
                yMax = Math.max(yMax, Math.abs(this.#data[index]));
            }
            this.#peaks[i] = yMax;
        }
        return {firstIndex: firstPeakIndex, peaks: this.#peaks};
    }

    #drawValues(startIndex, endIndex){
        let pixelStep = 2;        
        let pointCount = ~~(this.#svg.parentElement.offsetWidth / pixelStep);
        let peaks = this.#getPeaks(startIndex, endIndex, pointCount).peaks;
        let v = Math.max(Math.abs(this.#maxValue), Math.abs(this.#minValue));
        let path = 'M0 0L';
        for (let i = 0; i < peaks.length; i++){
            let value = peaks[i] / v * 256 * this.#scale;
            let x = i * pixelStep;
            if (i%2==0){
                path += x.toFixed(2) + ' ' + (value).toFixed(0) + ' ';
            } else {
                path += x.toFixed(2) + ' ' + (-value).toFixed(0) + ' ';
            }
            
        }
        this.#setViewBox(0, -256, peaks.length * pixelStep, 512);
        this.#svg.querySelector('path').setAttribute('d', path);

        let range = endIndex - startIndex;
        this.#samplesPerPixel = range / this.#svg.parentElement.offsetWidth;

        //  update scrollbar
        console.log('SamplesPerPixel: ' + this.#samplesPerPixel.toFixed(0), 'samplesPerPixel');
        console.log('Index start: ' + startIndex.toFixed(2) + ' end: ' + endIndex.toFixed(2), 'indexes');
        
        this.#scrollbar.style.width = (range / this.#data.length * this.#parent.offsetWidth)+'px';
        this.#scrollbar.style.left = (startIndex / this.#data.length * this.#parent.offsetWidth)+'px';
        
        console.log('update scrollbar scrollLeft: ' + this.#scrollbar.offsetLeft.toFixed(0) + ' width: ' + this.#scrollbar.offsetWidth.toFixed(0), 'scrollBar');

        if (typeof(this.onViewChange) === 'function'){
            this.onViewChange(this);
        }
    }    

    onViewChange;

    get data(){
        return this.#data;
    }

    get parent(){
        return this.#parent;
    }

    get svg(){
        return this.#svg;
    }

    get viewBox(){
        return this.#viewBox;
    }

    get startIndex(){
        return this.#startIndex;
    }

    set startIndex(value){
        this.#startIndex = value;
    }

    get endIndex(){
        return this.#endIndex;
    }

    set endIndex(value){
        this.#endIndex = value;
    }

    getIndex(clientX){
        return ~~(this.#startIndex + this.#samplesPerPixel * clientX);
    }

    getSeconds(clientX){
        return (this.#startIndex + this.#samplesPerPixel * clientX) / this.#options.sampleRate;
    }

    get maxZoom(){
        return this.#data.length / this.#svg.clientWidth;
    }

    get zoom(){
        return this.#data.length / (this.#endIndex - this.#startIndex);
    }

    set zoom(value){
        if (this.#setZoom(value)){
            this.#scrollZoom(this.#zoom, 0);    
        }
    }

    get scale(){
        return this.#scale;
    }

    set scale(value){
        this.#scale = value;
        this.#drawValues(this.#startIndex, this.#endIndex);
    }
}
