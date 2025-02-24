# wavedisplay
Work in progress but pretty tidy as it is. you want this if you need a fast and elegant solution to render a waveform on a web-page.

WaveDisplay is a javascript class with no dependencies. In the constructor you pass a number array and various other options to suit.
WaveDisplay will create the required HTML elements inside a container that you pass and render the waveform to SVG.

The UI is very responsive because it only renders the data that is visible. This also means there is no limit to how much audio data this control can hold.

All the usual scroll and zoom functions are implemented. Zoom To where you point at using the mouse scrollwheel. For touch screens there is pinch to zoom. You can simulate this with your mouse as follows:

CTRL Click to place your first touch lock point. Then click and hold to draw relative to that point to scale.

WaveDisplay also has scroll inertia. You can grab the wave form and give it a good push which causes it to keep going but gradually slow down.

## Demo

Every piece of library code must have a demo I think. so here it is.
https://dinther.github.io/wavedisplay/

![{3F47CAD7-F154-4C72-8206-CB3889BE5C19}](https://github.com/user-attachments/assets/070080b8-fd18-49aa-98e9-24a7811227b5)


## installation

Just grab wavedisplay.js from this repository and include it in your project.

```
  <script type="module">
    import {WaveDisplay} from './wavedisplay.js';
    ...
  </script>
```

## Usage

There is a demo in the form of a index.html file in the repository for you to play with.

Obtain your number array by whatever means works for you. But here is one way
```
// Set up audio context
window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

// Get the audio data
fetch('./I_have_been_waiting_for_you.mp3')
  .then(response => response.arrayBuffer())
  .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
  .then(audioBuffer => {
    let myNumberArray = audioBuffer.getChannelData(0); //  We only want one channel

    console.log(myNumberArray);

    // .... your code

  }
```

In the above code you have an opportunity to normalize the values, filter or reduce the number of samples. for example by averaging every 10 samples.
There are so many whats to manipulate this data that I didn't think this functionality belongs in this class.

WaveDisplay doesnt need normalised data because it keeps track of min and max values and adjusts the viewBox accordingly.

Below the code to put WaveDisplay to work.

```
let waveDisplay = new WaveDisplay({
  data: audioBuffer.getChannelData(0),
  parent: document.querySelector('#container'),
  samplesPerPoint: 60,
  sampleRate: audioBuffer.sampleRate,
  zoomRate: 0.1,
  decelerationTime: 4,
  scale: 1,
});
```

That it. WaveDisplay creates the required HTML elements inside the parent container you provide and renders your data in SVG.
Throw your own CSS at it to suit.

WaveDisplay has a mouse wheel zoom function built in where it zooms in towards where your mouse is.

## Simple API

### Options
You can pass the following options in the WaveDisplay constructor:

- data              Pass your number array to this.
- parent            The parent container object.
- samplesPerPoint   How many samples should be skipped for every svg point. 60 is the default. *
- sampleRate        Helpful when you want to work with seconds. The Wavedisplay.getSeconds depends on it.
- zoomRate          Use this to specify how fast you can zoom in with the mouse wheel. 0.1 is the default.
- decelerationTime  Time it takes to come to a stop after a swipe.
- scale             Scale up or down away from the normalized fitted values.

* samplesPerPoint needs some more explanation. An audio sample with a duration of 5 minutes and a standard bitrate of 44100 would have `5 * 60 * 44100 = 13230000` samples per channel. Yes that is over 13 million. It would be silly to render every value. Spread across a HD screen of 1920 pixels wide you would have 6890 samples for every pixel.

In order to get a decent performance and a pleasing looking display with plenty of detail we search for the maximum value for every even pixel and a minimum value for every odd pixel. However, working out the maximum value out of 6890 numbers is still inefficient. Instead we take a number of samples out of these 6890 numbers and find the minimum or maximum of those. `options.samplesPerPoint` defines how many samples should be taken to find the minimum or maximum for a pixel.

### Properties

`zoom` Set the zoom level. A value of 1 will render the entire waveform in the confines of the available container. A zoom factor of 2 show half of the available data and so on. A scrollbar will automatically show when required. Tzoom the value is calculated based on the startIndex, endIndex and size of the parent container when it is read.

`scale` Set the scale of the data. A value of 1 will render the waveform so the amplitude will fit in the confines of the available container. A scale factor of 2 renders the amplitude twice as tall.

`svg` Provides acces to the internal svg element created by WaveDisplay.

`scrollbar` Provides direct access to the scrollbar element. Set 'WaveDisplay.scrollbar.style.display="none"' to hide the scrollbar for example.

'maxZoom' WaveDisplay won't render the data to less than the width of the parent container. This means that for a given window there will be a maximum allowable zoom level. Read this value to adjust max range of your own UI controls.

`samplesPerPixel` Read this value to find out how many entries from the data represent one pixel. This value changes when you zoom in or when the window size changes. You can use this value to perform your own calculations

`startIndex` WaveDisplay renders an array of numbers as a waveform. It uses startIndex and endIndex to define the data segment currently rendered. The value must be between 0 and the length of the data array provided via `.options.data`. Note: Changing the startIndex causes the zoom value to change.

`endIndex` WaveDisplay renders an array of numbers as a waveform. It uses startIndex and endIndex to define the data segment currently rendered. The value must be between 0 and the length of the data array provided via `.options.data`. Note: Changing the endIndex causes the zoom value to change.

### Methods

`WaveDisplay.getIndex(x)` Use this function to obtain the sample index at a specific point in the wave form. This index is a float. I kept it that way so you can better target a sample with sub pixel precision. The value X you pass in would typically be a pixel coordinate such as the clientX property of a pointer event.

```
container.addEventListener('pointerDown',(e)=>{
  console.log('Sample index: ' + waveDisplay.getIndex(e.clientX));
});
```

### Events

`onViewChange` Use this callback if you want to do additional rendering every time WaveDisplay finishes it's render. Renders only happen after the view changes in some way like scrolling, zooming in or scale changes. WaveDisplay passes itself as the only parameter.
Example 
```
waveDisplay.onViewChange = (obj)=>{
  myZoomSliderElement.max = obj.maxZoom;
}
```
