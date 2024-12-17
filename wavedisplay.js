export class WaveDisplay{
    #options = {
        data: [],
        parent: document.body,
        samplesPerPoint: 60,
        sampleRate: 44100,
        zoomRate: 0.01,
        deceleration: 10,
    }
    #parent;
    #svg;
    #data;
    #peaks;
    #samplesPerPixel = 1;
    #startIndex;
    #endIndex;
    #zoom = 1;
    #startX;
    #lastMoveTime = null;
    #lastMoveX = null;
    #scrollSpeed;
    #minValue;
    #maxValue;
    #scrollbar;
    #zoomPinchMode = false;
    #evCache = [];
    #startLeftLock = -1;
    #startRightLock = -1;
    #lockRange = -1;
    #viewBox = {xmin:0, ymin:0, xmax:100, ymax:100};
    constructor(options){
        this.#options = {...this.#options, ...options};
        this.#parent = this.#options.parent;
        this.#data = this.#options.data;
            
        this.#svg = this.#createSVG(this.#options.parent);
        this.#scrollbar = document.createElement('div');
        this.#scrollbar.classList.add('scrollbar');
        this.#scrollbar.appendChild(document.createElement('div'));
        this.#options.parent.appendChild(this.#scrollbar);
        this.#scrollbar.addEventListener('scroll', e=>{
            let range = this.#endIndex - this.#startIndex;
            this.#startIndex = Math.min(this.#data.length - range, Math.max(0, this.#scrollbar.scrollLeft * this.#samplesPerPixel));
            this.#endIndex = this.#startIndex + range;
            this.#drawValues(this.#startIndex , this.#endIndex );
        });

        this.#parent.addEventListener('pointerdown',e =>{        
            if (e.ctrlKey){
                //  create a copy of the event but with a new pointerID
                let ctrlPointer = new PointerEvent('pointerdown',{pointerId:-1, type: e.pointerType, clientX: e.clientX, clientY:e.clientY});
                this.#addEvent(ctrlPointer);
                console.log('ctrlPoint id: '+ctrlPointer.pointerId+' set: ' + ctrlPointer.clientX);
            } else {
                this.#addEvent(e);
                this.#parent.setPointerCapture(e.pointerId);
            }
            this.#scrollSpeed = 0;
            this.#lastMoveTime = null;
            this.#lastMoveX = null;
            this.#startX = e.clientX;
        });  

        this.#parent.addEventListener('pointerup',e =>{
            this.#parent.releasePointerCapture(e.pointerId);
            if ( this.#zoomPinchMode || e.timeStamp -  this.#lastMoveTime > 10 ){
                this.#scrollSpeed = 0;
                this.#lastMoveTime = null;
                this.#lastMoveX = null;
            }
            
            if (e.ctrlKey){
                e.preventDefault();
                e.stopPropagation();
            }

            if (Math.abs(this.#scrollSpeed) > 1){
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
            if(e.buttons==0){
                return;
            }
            
            // Find this event in the cache and update its record with this event
            const index = this.#evCache.findIndex(
                (cachedEv) => cachedEv.pointerId === e.pointerId
            );           
            this.#evCache[index] = e;

            e.preventDefault(); 
            
            //  Pinch to zoom
            if (this.#evCache.length === 2) {
                
                const leftPos = Math.min(this.#evCache[0].clientX , this.#evCache[1].clientX);
                const rightPos = Math.max(this.#evCache[0].clientX , this.#evCache[1].clientX)
                if (this.#startLeftLock < 0 || this.#startRightLock < 0){
                    this.#startLeftLock =  this.#startIndex + (this.#samplesPerPixel * leftPos);
                    this.#startRightLock = this.#startIndex + (this.#samplesPerPixel * rightPos);
                    this.#lockRange = this.#startRightLock - this.#startLeftLock;
                } else {
                    const pixelRange = rightPos - leftPos;
                    this.#samplesPerPixel = this.#lockRange / pixelRange;
                    console.log('left: ' + leftPos.toFixed(0) + ' right: ' + rightPos.toFixed(0), 'pinchZoom');
                    console.log('samplesPerPixel: ' + this.#samplesPerPixel, 'samplesPerPixel');
                    this.#startIndex = Math.min(this.#data.length, Math.max(0, ~~(this.#startLeftLock - (leftPos * this.#samplesPerPixel))));
                    this.#endIndex = Math.min(this.#data.length, Math.max(0, ~~(this.#startRightLock + (this.#svg.clientWidth - rightPos) * this.#samplesPerPixel)));
                    this.#drawValues(this.#startIndex, this.#endIndex);
                }
            }
               
            //  inertia code
            if (this.#lastMoveTime != null){
                this.#scrollSpeed = (e.clientX - this.#lastMoveX) * (e.timeStamp - this.#lastMoveTime) * 0.5;
            }
            this.#lastMoveTime = e.timeStamp;
            this.#lastMoveX = e.clientX;
            const walkX = e.clientX - this.#startX;
            this.#startX += walkX;
            let range = this.#endIndex - this.#startIndex;
            this.#startIndex = Math.min(this.#data.length - range, Math.max(0, this.#startIndex - (walkX * this.#samplesPerPixel)));
            this.#endIndex = this.#startIndex + range;
            this.#drawValues(this.#startIndex , this.#endIndex );
        });

        window.addEventListener("resize", (event) => {
            this.#drawValues(this.#startIndex, this.#endIndex);
        });

        this.#findMinMax();
        this.#setZoom(this.#options.zoom);
        this.#startIndex = 0;
        this.#endIndex = this.#data.length / this.#zoom;
        
        this.#drawValues(this.#startIndex, this.#endIndex);
    }

    #pinchZoomFinished(e) {
        if (this.#removeEvent(e.pointerId) && this.#zoomPinchMode){
            this.#evCache = [];
            this.#zoomPinchMode = false;
            this.#startLeftLock = -1;
            this.#startRightLock = -1;
            console.log('pinchZoom ended.');
            console.log('Total cache size: ' + this.#evCache.length, 'cacheSize');
        }
    }

    #addEvent(e) {
        this.#evCache.push(e);
        this.#zoomPinchMode = this.#evCache.length > 1;
        console.log('add   id: '+e.pointerId+' clientX: ' + e.clientX.toFixed(0));
        console.log('Total cache size: ' + this.#evCache.length, 'cacheSize');
        if (this.#zoomPinchMode) console.log('pinchZoom started.');
    }

    #removeEvent(pointerId) {
        if (!pointerId || typeof pointerId === 'undefined') return false;
        if (this.#evCache.length === 0) return false;

        const index = this.#evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === pointerId,
          );

          if (index > -1){
            this.#evCache.splice(index, 1);
            console.log('Del id: ' + pointerId);
            console.log('Total cache size: ' + this.#evCache.length, 'cacheSize');
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
        let decelSpeed = this.#options.deceleration * totalTime;
        if (this.#scrollSpeed > 0) decelSpeed *= -1;
        if (Math.abs(this.#scrollSpeed) < Math.abs(decelSpeed)){
            this.#scrollSpeed = 0;
            return;
        }
        let range = this.#endIndex - this.#startIndex;     
        this.#startIndex = Math.min(this.#data.length - range, Math.max(0, ~~(this.#startIndex - (this.#scrollSpeed + decelSpeed) * this.#samplesPerPixel)));
        this.#endIndex = this.#startIndex + range;
        this.#drawValues(this.#startIndex , this.#endIndex );
        this.#scrollbar.scrollLeft = this.#startIndex / this.#samplesPerPixel;
        requestAnimationFrame(this.#keepScrolling.bind(this));
    }

    #createSVG(){
        const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('values-svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M0 0L100 0 100 32 0 32 0 0');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.appendChild(path);
        svg.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });
        this.#parent.appendChild(svg);
        return svg;
    }

    #handleWheel(e){
        this.#setZoom(this.#zoom * Math.exp(-e.deltaY / 80 * this.#options.zoomRate));
        let along = e.clientX / this.#svg.clientWidth;
        this.#scrollZoom(along);
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

    #scrollZoom(along = 0.5){
        let oldRange = this.#endIndex - this.#startIndex;
        let lockIndex = this.#startIndex + ~~(along * oldRange);
        let newRange = this.#data.length / this.#zoom;
        this.#samplesPerPixel = newRange / this.#svg.clientWidth / this.#zoom;
        this.#startIndex = Math.max(0, lockIndex - ~~(newRange * along));
        this.#endIndex = Math.min(this.#data.length, ~~(this.#startIndex + newRange));
        this.#drawValues(this.#startIndex, this.#endIndex);
    }

    #setViewBox(xmin, ymin, xmax, ymax){
        this.#viewBox.xmin = xmin!=null? xmin : this.#viewBox.xmin;
        this.#viewBox.ymin = ymin!=null? ymin : this.#viewBox.ymin;
        this.#viewBox.xmax = xmax!=null? xmax : this.#viewBox.xmax;
        this.#viewBox.ymax = ymax!=null? ymax : this.#viewBox.ymax;
        this.#svg.setAttribute('viewBox', this.#viewBox.xmin + ' ' +this.#viewBox.ymin + ' ' +this.#viewBox.xmax + ' ' + this.#viewBox.ymax);
        //this.#samplesPerPixel = this.#data.length / this.#svg.clientWidth / this.#zoom;
    }

    #getPeaks(startIndex, endIndex, pointCount){
        this.#peaks = [];
        let range = endIndex - startIndex;
        let sampleStep = Math.max(1, ~~(range / pointCount));
        let avgSampleCount = 50;
        startIndex = ~~(startIndex / (sampleStep * 2)) * sampleStep * 2;
        let firstPeakIndex = null;
        for (let i=0; i < pointCount; i++){
            let yMax= 0;
            let sampleCount = Math.min(sampleStep, avgSampleCount);
            let step = Math.max(1,~~(sampleStep / avgSampleCount));
            for (let j = 0; j < sampleCount; j++){
                let index = startIndex + (i * sampleStep) + ~~(j*step);
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
            let value = peaks[i] / v * 256;
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
        console.log('samplesPerPixel: ' + this.#samplesPerPixel, 'samplesPerPixel');
        this.#scrollbar.children[0].style.width = (this.#data.length / this.#samplesPerPixel) + 'px';
        this.#scrollbar.scrollLeft = startIndex / this.#samplesPerPixel;
        console.log('update scrollbar scrollLeft: ' + this.#scrollbar.scrollLeft + ' width: ' + this.#scrollbar.children[0].style.width, 'scrollBar');

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

    getIndex(x){
        return ~~(this.#startIndex + this.#samplesPerPixel * x);
    }

    getSeconds(x){
        return this.getIndex(x) / this.#options.sampleRate;
    }

    get maxZoom(){
        return this.#data.length / this.#svg.clientWidth;
    }

    get zoom(){
        return this.#zoom;
    }

    set zoom(value){
        if (this.#setZoom(value)){
            this.#scrollZoom(0);    
        }
    }
}
