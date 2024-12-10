export class WaveDisplay{
    #options = {
        data: [],
        parent: document.body,
        samplesPerPoint: 60,
        sampleRate: 44100,
        zoomRate: 0.1
    }

    #svg;
    #scrollbar;
    #minValue=null;
    #maxValue=null;

    #samplesPerPixel;
    #zoom = 1;
    #viewBox = {xmin:0, ymin:0, xmax:100, ymax:100};
    constructor(options){
        this.#options = {...this.#options, ...options};
        this.#svg = this.#createSVG(this.#options.parent);
        this.#scrollbar = this.#createScrollbar(this.#options.parent);
        this.#scrollbar.children[0].style.width = (zoom.value * 100) + '%';
        this.#drawValues();
    }

    #createSVG(parent){
        const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('values-svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M0 0L100 0 100 32 0 32 0 0');
        svg.appendChild(path);
        svg.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });
        svg.addEventListener('click', this.#handleClick.bind(this), { passive: false });
        this.#options.parent.appendChild(svg);
        return svg;
    }

    #handleWheel(e){
        let lockIndex = this.#samplesPerPixel * (e.clientX + this.#scrollbar.scrollLeft);
        let zoom = Math.min(100, Math.max(1, this.#zoom * Math.exp(-e.deltaY / 80 * this.#options.zoomRate)));  
        this.#scrollZoom(zoom);
        this.#scrollbar.scrollLeft  = (lockIndex - (e.clientX * this.#samplesPerPixel)) / this.#samplesPerPixel;
        
    }

    #handleClick(e){
        let index = this.#samplesPerPixel * (e.clientX + this.#scrollbar.scrollLeft);
        this.#scrollZoom(this.#zoom);
    }

    #createScrollbar(parent){
        let scrollbar = document.createElement('div');
        scrollbar.className = 'scrollbar';
        let scrollbarRange = document.createElement('div');
        scrollbar.appendChild(scrollbarRange);
        parent.appendChild(scrollbar);
        scrollbar.addEventListener('scroll', (e)=>{
            this.#scrollZoom(this.#zoom);
        });
        return scrollbar;
    }

    #scrollZoom(zoom){
        this.#zoom = Math.abs(zoom);
        this.#scrollbar.children[0].style.width = (this.#zoom * 100) + '%';
        let offset = this.#scrollbar.scrollLeft / this.#scrollbar.scrollWidth * this.#options.data.length;
        this.#setViewBox(offset, null, this.#options.data.length / this.#zoom, null);
    }

    #setViewBox(xmin, ymin, xmax, ymax){
        this.#viewBox.xmin = xmin!=null? Math.floor(xmin) : this.#viewBox.xmin;
        this.#viewBox.ymin = ymin!=null? Math.floor(ymin) : this.#viewBox.ymin;
        this.#viewBox.xmax = xmax!=null? Math.floor(xmax) : this.#viewBox.xmax;
        this.#viewBox.ymax = ymax!=null? Math.floor(ymax) : this.#viewBox.ymax;
        this.#samplesPerPixel = this.#options.data.length / this.#scrollbar.children[0].offsetWidth;
        this.#svg.setAttribute('viewBox', this.#viewBox.xmin + ' ' +this.#viewBox.ymin + ' ' +this.#viewBox.xmax + ' ' + this.#viewBox.ymax);
    }

    #filterData(data) {
        const blockSize = this.#options.samplesPerPoint;
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(data[blockStart + j]);
            }
            filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
        }
        return filteredData;
    };

    #normalizeData(data){
        const multiplier = Math.pow(Math.max(...data), -1);
        return data.map(n => n * multiplier);
    }

    #normalizeData1(data){
        let maxV = 0;
        for (let i=0; i<data.length; i++){
            maxV = Math.max(maxV, Math.abs(data[i]));
        }
        let f = 1/maxV;
        return data.map(n => n * f);
    }

    #drawValues(){
        let samples = this.#options.data.length / this.#options.samplesPerPoint;
        let h = this.#svg.parentElement.offsetHeight;
        const sampleStep = Math.floor(this.#options.data.length / samples);
        let path = 'M0 100';
        path += 'L';
        for (let i = 0; i < this.#options.data.length; i+=sampleStep) {
            let value = (0.5 * h) + (this.#options.data[i] * h);   
            this.#minValue = this.#minValue == null? value : Math.min(this.#minValue, value); 
            this.#maxValue = this.#maxValue == null? value : Math.max(this.#maxValue, value);
            path += i.toFixed(0) + ' ' + value.toFixed(0) + ' ';
        }
        this.#setViewBox(0, this.#minValue, this.#options.data.length, this.#maxValue);
        this.#svg.querySelector('path').setAttribute('d', path);
        this.#svg.setAttribute('preserveAspectRatio', 'none');
    }

    #indexToTime
    zoom(value){
        this.#scrollZoom(value);
    }
}
