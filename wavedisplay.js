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
    #data;
    #samplesPerPixel;
    #zoom = 1;
    #viewBox = {xmin:0, ymin:0, xmax:100, ymax:100};
    constructor(options){
        this.#options = {...this.#options, ...options};
        this.#data = this.#options.data;
        this.#svg = this.#createSVG(this.#options.parent);
        this.#scrollbar = this.#createScrollbar();
        this.#scrollbar.children[0].style.width = (zoom.value * 100) + '%';
        this.#drawValues();
    }

    #createSVG(){
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
        let lockIndex = this.getIndex(e.clientX);
        let zoom = Math.min(100, Math.max(1, this.#zoom * Math.exp(-e.deltaY / 80 * this.#options.zoomRate)));  
        this.#scrollZoom(zoom);
        this.#scrollbar.scrollLeft  = (lockIndex - (e.clientX * this.#samplesPerPixel)) / this.#samplesPerPixel;
        
    }

    #handleClick(e){
        let index = this.#samplesPerPixel * (e.clientX + this.#scrollbar.scrollLeft);
        this.#scrollZoom(this.#zoom);
    }

    #createScrollbar(){
        let scrollbar = document.createElement('div');
        scrollbar.className = 'scrollbar';
        let scrollbarRange = document.createElement('div');
        scrollbar.appendChild(scrollbarRange);
        this.#options.parent.appendChild(scrollbar);
        scrollbar.addEventListener('scroll', (e)=>{
            this.#scrollZoom(this.#zoom);
        });
        return scrollbar;
    }

    #scrollZoom(zoom){
        this.#zoom = Math.abs(zoom);
        this.#scrollbar.children[0].style.width = (this.#zoom * 100) + '%';
        let offset = this.#scrollbar.scrollLeft / this.#scrollbar.scrollWidth * this.#data.length;
        this.#setViewBox(offset, null, this.#data.length / this.#zoom, null);
    }

    #setViewBox(xmin, ymin, xmax, ymax){
        this.#viewBox.xmin = xmin!=null? xmin : this.#viewBox.xmin;
        this.#viewBox.ymin = ymin!=null? ymin : this.#viewBox.ymin;
        this.#viewBox.xmax = xmax!=null? xmax : this.#viewBox.xmax;
        this.#viewBox.ymax = ymax!=null? ymax : this.#viewBox.ymax;
        this.#samplesPerPixel = this.#data.length / this.#scrollbar.children[0].offsetWidth;
        this.#svg.setAttribute('viewBox', this.#viewBox.xmin + ' ' +this.#viewBox.ymin + ' ' +this.#viewBox.xmax + ' ' + this.#viewBox.ymax);
    }

    #drawValues(){
        let samples = this.#data.length / this.#options.samplesPerPoint;
        let h = this.#svg.parentElement.offsetHeight;
        const sampleStep = Math.floor(this.#data.length / samples);
        let path = 'M0 100';
        path += 'L';
        let minValue=null;
        let maxValue=null;
        for (let i = 0; i < this.#data.length; i+=sampleStep) {
            let value = 128 + this.#data[i] * 128;   
            minValue = minValue == null? value : Math.min(minValue, value); 
            maxValue = maxValue == null? value : Math.max(maxValue, value);
            path += i.toFixed(0) + ' ' + value.toFixed(0) + ' ';
        }
        this.#setViewBox(0, minValue, this.#data.length, maxValue);
        this.#svg.querySelector('path').setAttribute('d', path);
        this.#svg.setAttribute('preserveAspectRatio', 'none');
    }

    getIndex(x){
        return this.#samplesPerPixel * (x + this.#scrollbar.scrollLeft);
    }

    getSeconds(x){
        return this.getIndex(x) / this.#options.sampleRate;
    }

    zoom(value){
        this.#scrollZoom(value);
    }
}
