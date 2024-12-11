export class WaveDisplay{
    #options = {
        data: [],
        parent: document.body,
        samplesPerPoint: 60,
        sampleRate: 44100,
        zoomRate: 0.1,
    }
    #parent;
    #svg;
    #data;
    #samplesPerPixel;
    #zoom = 1;
    #viewBox = {xmin:0, ymin:0, xmax:100, ymax:100};
    constructor(options){
        this.#options = {...this.#options, ...options};
        this.#parent = this.#options.parent;
        this.#data = this.#options.data;
        this.#svg = this.#createSVG(this.#options.parent);
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
        this.#parent.appendChild(svg);
        return svg;
    }

    #handleWheel(e){
        let lockIndex = this.getIndex(e.clientX);
        //console.log('clientX ', e.clientX, 'lockindex',lockIndex);
        let zoom = Math.min(100, Math.max(1, this.#zoom * Math.exp(-e.deltaY / 80 * this.#options.zoomRate)));  
        this.#scrollZoom(zoom);
        this.#parent.scrollLeft  = (lockIndex - (e.clientX * this.#samplesPerPixel)) / this.#samplesPerPixel;
    }

    #handleClick(e){
        let index = this.getIndex(e.clientX);
        let testLeft = (index - (e.clientX * this.#samplesPerPixel)) / this.#samplesPerPixel;
    }

    #scrollZoom(zoom){
        this.#zoom = Math.abs(zoom);
        this.#svg.style.width = (this.#zoom * 100) + '%';
        this.#samplesPerPixel = this.#data.length / this.#svg.clientWidth;
        //console.log('samplesPerPixel',this.#samplesPerPixel);
    }

    #setViewBox(xmin, ymin, xmax, ymax){
        this.#viewBox.xmin = xmin!=null? xmin : this.#viewBox.xmin;
        this.#viewBox.ymin = ymin!=null? ymin : this.#viewBox.ymin;
        this.#viewBox.xmax = xmax!=null? xmax : this.#viewBox.xmax;
        this.#viewBox.ymax = ymax!=null? ymax : this.#viewBox.ymax;
        this.#svg.setAttribute('viewBox', this.#viewBox.xmin + ' ' +this.#viewBox.ymin + ' ' +this.#viewBox.xmax + ' ' + this.#viewBox.ymax);
        this.#samplesPerPixel = this.#data.length / this.#svg.clientWidth;
        //console.log('setViewBox - samplesPerPixel:', this.#samplesPerPixel, 'clientWidth:', this.#svg.clientWidth);
    }

    #drawValues(){
        let samples = this.#data.length / this.#options.samplesPerPoint;
        let h = this.#svg.parentElement.offsetHeight;
        const sampleStep = Math.floor(this.#data.length / samples);
        let path = 'M0 100';
        path += 'L';
        let minValue=null;
        let maxValue=null;

        //  Find min and max
        for (let i = 0; i < this.#data.length; i++) {
            let value = this.#data[i];
            minValue = minValue == null? value : Math.min(minValue, value); 
            maxValue = maxValue == null? value : Math.max(maxValue, value);
        }

        let v = Math.max(Math.abs(maxValue), Math.abs(minValue));
        maxValue = v;
        minValue = -v;

        for (let i = 0; i < this.#data.length; i+=sampleStep) {
            let value = this.#data[i] * maxValue * h;
            path += i.toFixed(0) + ' ' + value.toFixed(0) + ' ';
        }

        this.#setViewBox(0, minValue * h, this.#data.length, maxValue * h *2);
        this.#svg.querySelector('path').setAttribute('d', path);
        this.#svg.setAttribute('preserveAspectRatio', 'none');
    }

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

    getIndex(x){
        let index = this.#samplesPerPixel * (x + this.#parent.scrollLeft);
       // console.log('getIndex - samplesPerPixel:',this.#samplesPerPixel,'x:',x,'scrollLeft:',this.#parent.scrollLeft, 'index:',index);
        return index;
    }

    getSeconds(x){
        return this.getIndex(x) / this.#options.sampleRate;
    }
    get zoom(){
        this.#zoom;
    }

    set zoom(value){
        if (value != this.#zoom){
            this.#scrollZoom(value);    
        }
    }
}
