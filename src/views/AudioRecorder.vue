<template>
  <div class="h5p-audio-recorder-view">
    <div v-if="state !== 'done'  && title" class="title" v-html="title" />

    <vuMeter :avgMicFrequency="avgMicFrequency" :enablePulse="state === 'recording'" v-if="(state !== 'done' && state !== 'solution')"></vuMeter>
    
    <div role="status" v-bind:class="state" v-html="statusMessages[state]" />

    <div class="h5p-audio-recorder-player" v-if="(state == 'ready' || state == 'playing') && audioFileSrc !== ''">
      <audio ref="audioFilePlayer" controls="controls" controlslist="nodownload" v-on:ended="autoRecord">
        Your browser does not support the <code>audio</code> element.
        <source v-bind:src="audioFileSrc">
      </audio>
    </div>

    <div class="h5p-audio-recorder-player" v-if="canRetry && (state === 'done' || state === 'solution') && audioSrc !== ''">
      Your answer: <audio controls="controls" controlslist="nodownload">
        Your browser does not support the <code>audio</code> element.
        <source v-bind:src="audioSrc">
      </audio>
    </div>

    <div class="h5p-audio-recorder-player" v-if="canCheck && (state === 'solution') && solutionFileSrc !== ''">
      Solution: <audio controls="controls" controlslist="nodownload">
        Your browser does not support the <code>audio</code> element.
        <source v-bind:src="solutionFileSrc">
      </audio>
    </div>

    <timer ref="timer" v-bind:stopped="state !== 'recording' && state !== 'pre-recording'" 
      v-if="state !== 'playing' || state !== 'unsupported' && state !== 'done' && state !== 'insecure-not-allowed'"></timer>

    <div class="button-row">
      <div class="button-row-double">
        <button class="button record small"
                v-if="state === 'ready' || state === 'blocked'"
                ref="button-record"
                v-on:click="record">
          <span class="fa-circle"></span>
          {{ l10n.recordAnswer }}
        </button>
        <button class="button retry small"
                v-if="canRetry && (state === 'recording' || state === 'paused')"
                v-on:click="retry">
          <span class="fa-undo"></span>
          <span class="small-screen-hidden">{{ l10n.retry }}</span>
        </button>
        <button class="button pause small"
                ref="button-pause"
                v-if="canPause && state === 'recording'"
                v-on:click="pause">
          <span class="fa-pause"></span>
          <span class="small-screen-hidden">{{ l10n.pause }}</span>
        </button>
        <button class="button record small"
                ref="button-continue"
                v-if="state === 'paused'"
                v-on:click="record">
          <span class="fa-circle"></span>
          <span class="small-screen-hidden">{{ l10n.continue }}</span>
        </button>
        <button class="button done small"
                v-if="state === 'recording' || state === 'paused'"
                v-on:click="done">
          <span class="fa-play-circle"></span>
          <span class="small-screen-hidden">{{ l10n.done }}</span>
        </button>
      </div>

      <span class="button-row-left">
        <a class="button download"
           ref="button-download"
           v-if="canDownload && (state === 'done' || state === 'solution')" 
           v-bind:href="audioSrc"
           v-bind:download="audioFilename">
          <span class="icon-download"></span>
          {{ l10n.download }}
        </a>
      </span>

      <span class="button-row-right">
        <button class="button retry small"
                v-if="canRetry && (state === 'done' || state === 'cant-create-audio-file' || state === 'solution')"
                v-on:click="retry">
          <span class="fa-undo"></span>
          <span class="small-screen-hidden">{{ l10n.retry }}</span>
        </button>
         <button class="button done small"
                v-if="canCheck && (state === 'done')"
                v-on:click="check">
          <span class="fa-play-circle"></span>
          <span class="small-screen-hidden">{{ l10n.check }}</span>
        </button>
      </span>
    </div>
  </div>
</template>

<script>
  import State from '../components/State';

  // focus on ref when state is changed
  const refToFocusOnStateChange = {};
  refToFocusOnStateChange[State.READY] = 'button-record';
  refToFocusOnStateChange[State.RECORDING] = 'button-pause';
  refToFocusOnStateChange[State.PAUSED] = 'button-continue';
  refToFocusOnStateChange[State.DONE] = 'button-download';

  export default {
    methods: {
      record: function() {
        this.$emit(State.RECORDING);
        if (this.timeLimit > 0)
          setTimeout(() => this.done(), (this.timeLimit * 1000) + 200);
      },

      recordDelay: function() {
        if(this.$refs.timer) {
          this.$refs.timer.reset(this.delayStart); // countdown
        }
        this.state = State.PRE_RECORDING;
        setTimeout(() => {
          if (this.state === State.PRE_RECORDING){ // makre sure state is not changed
            const beep = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");  
            beep.play(); // play a beep

            this.state = State.READY; // ensure timer 'stopped' is changed
            if(this.$refs.timer) {
              this.$refs.timer.reset(0, this.timeLimit);
            }
            this.record();
          }
        }, (this.delayStart * 1000) + 200);
      },

      autoRecord: function() {
        if (!this.isEditor && this.delayStart > 0)
          this.recordDelay();
        else 
          this.record();
      },

      pause: function() {
        if (!this.canPause)
          return;
        this.state = State.PAUSED;
        this.$emit(this.state);
      },

      done: function() {
        this.state = State.DONE;
        this.$emit(State.DONE);
      },

      check: function() {
        this.state = State.SOLUTION;
        this.$emit(State.SOLUTION);
      },

      stop: function() {
        if (this.$refs.audioFilePlayer){
          this.$refs.audioFilePlayer.pause();
          this.$refs.audioFilePlayer.currentTime = 0;
        }
        this.state = State.READY;
        if(this.$refs.timer) {
          this.$refs.timer.reset(0, this.timeLimit);
        }
      },

      retry: function() {
        if (!this.canRetry)
          return;
        const dialog = new H5P.ConfirmationDialog(
          {
            headerText: this.l10n.retryDialogHeaderText,
            dialogText: this.l10n.retryDialogBodyText,
            cancelText: this.l10n.retryDialogCancelText,
            confirmText: this.l10n.retryDialogConfirmText
          }
        );
        dialog.appendTo(this.$el);
        dialog.show();
        dialog.on('confirmed', () => {
          this.state = State.READY;
          if(this.$refs.timer) {
          this.$refs.timer.reset(0, this.timeLimit);
        }
          this.$emit('retry');
        });
      },

      playAudioFile: function(){
        if (this.$refs.audioFilePlayer){
          this.state = State.PLAYING;
          setTimeout(() => this.$refs.audioFilePlayer.play(), 1000);
        }
      }
    },

    filters: {
      unEscape: function(str) {
        return str.replace(/&#039;/g, '\'');
      },
    },

    watch: {
      state: function(state){
        if(refToFocusOnStateChange[state] && this.$refs[refToFocusOnStateChange[state]]) {
          this.$nextTick(() => this.$refs[refToFocusOnStateChange[state]].focus());
        }
      }
    },

    mounted: function () {
      if (this.$refs.timer) {
          this.$refs.timer.setTimeLimit(this.timeLimit);
      }
    }
  }
</script>

<style lang="scss" type="text/scss">
  $screen-small: 576px;
  $record-button-width: 8.2em;

  @mixin blueGlow {
    outline: 0;
    box-shadow: 0.06em 0 0.6em 0.1em lighten(#0a78d1, 30%);
  }

  .h5p-content:not(.using-mouse) .h5p-audio-recorder-view .button:focus {
    @include blueGlow
  }

  .h5p-audio-recorder-view {
    font-size: 1em;
    padding: 0.9em;
    text-align: center;

    [class^="fa-"] {
      font-family: 'H5PFontAwesome4';
    }

    .fa-microphone {
      width: 50%;
      height: 50%;
      left: 50%;
      top: 50%;
      transform: translate(-50%,-50%);
      position: absolute;
      font-size: 1em;
      border-radius: 50%;
      background-color: white;
      line-height: 2.5em;
    }

    .h5p-audio-recorder-player {
      box-sizing: border-box;
      margin: 1em 1em 0 1em;

      audio {
        width: 100%;
        height: 30px;
      }
    }

    .title {
      color: black;
      font-size: 1em;
      margin-bottom: 1em;
      line-height: 1em;
      text-align: left;
    }

    .icon-download {
      &:before {
        font-family: 'H5PFontIcons';
        content: '\e918';
      }
    }

    /* status bar */
    [role="status"] {
      background-color: #f8f8f8;
      color: #777777;
      padding: 0.3em;

      &.recording {
       background-color: #f9e5e6;
       color: #da5254;
      }

      &.done {
        background-color: #e0f9e3;
        color:  #20603d;
      }

      &.blocked,
      &.unsupported,
      &.insecure-not-allowed,
      &.cant-create-audio-file {
        background-color: #db8b8b;
        color: black;
      }
    }

    .small-screen-hidden {
      display: none;
    }

    .h5p-audio-recorder-download {
      font-size: 1em;
      padding: 2em;
    }

    .h5p-confirmation-dialog-popup {
      top: 5em;
      width: 35em;
      max-width: 100%;
      min-width: 0;
    }

    .button-row {
      margin-bottom: 1em;

      .button-row-double {
        width: 100%;
      }

      .button-row-left {
        text-align: right;
        flex: 1;
      }

      .button-row-right {
        text-align: left;
        flex: 1;
      }
    }

    @media (min-width: $screen-small) {
      .small-screen-hidden {
        display: inherit;
      }
    }

    @mixin button-filled($background-color, $color) {
      background-color: $background-color;
      color: $color;
      border-color: $background-color;
      border: 2px solid $background-color;
      box-sizing: border-box;

      &:hover {
        background-color: darken($background-color, 5%);
        border-color: darken($background-color, 5%);
      }

      &:active {
        background-color: darken($background-color, 10%);
        border-color: darken($background-color, 10%);
      }

      &[disabled] {
        background-color: lighten($background-color, 40%);
        border-color: lighten($background-color, 40%);
      }
    }

    @mixin button-inverse($background-color, $color) {
      background-color: $background-color;
      color: $color;
      border: 2px solid $color;
      box-sizing: border-box;

      &:hover {
        color: lighten($color, 10%);
        border-color: lighten($color, 10%);
      }

      &:active {
        color: darken($color, 10%);
        border-color: darken($color, 10%);
      }

      &[disabled],
      &[aria-disabled] {
        color: lighten($color, 40%);
        border-color: lighten($color, 40%);
      }
    }

    .button {
      font-size: 1em;
      padding: 0.5em 1em;
      border-radius: 2em;
      margin: 0 0.5em;
      border: 0;
      display: inline-block;
      cursor: pointer;
      text-decoration: none;
      font-weight: 600;
      white-space: nowrap;

      [class^="fa-"] {
        font-weight: 400;
      }

      &.small {
        font-size: 0.85em;
      }

      &.done {
        @include button-inverse(white, #1f824c);
      }

      &.retry {
        @include button-filled(#5e5e5e, white);
      }

      &.record {
        @include button-filled(#d95354, white);
      }

      &.download {
        @include button-filled(#1f824c, white);
      }

      &.pause {
        @include button-inverse(white, #d95354);
      }

      @media (min-width: $screen-small) {
        [class^="fa-"] {
          margin-right: 0.4em;
        }

        &.record,
        &.pause {
          min-width: $record-button-width;
        }
      }
    }
  }
</style>
