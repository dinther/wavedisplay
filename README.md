# wavedisplay
you want this if you need a fast and elegant solution to render a waveform on a web-page.

WaveDisplay is a javascript class with no dependencies. In the constructor you pass a number array and various other options to suit.
WaveDisplay will create the required HTML elements inside a container that you pass and render the waveform to SVG.

The UI is very responsive because after it has rendered it is just a matter of changing the viewBox in order to zoom or scroll.
WaveDisplay also support the mouse scrollwheel to zoom towards a data point.

## installation

Just grab wavedisplay.js from this repository and include it in your project.

```
  <script type="module">
    import {WaveDisplay} from './wavedisplay.js';
    ...
  </script>
```

##Usage

There is a demo.html file in the repository for you to play with.

![{FBE0628F-C587-43A5-AA90-55142A6F6C30}](https://github.com/user-attachments/assets/3cf52a04-9929-4c01-888b-cdb78f025d50)

