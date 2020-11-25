<template>
  <div role="timer" class="audio-recorder-timer">
    {{secondsPassed | formatTime}}
    <span class="time-limit" v-if="timeLimit > 0">{{timeLimit | formatTime}}</span>
  </div>
</template>

<script>
  const Timer = require('timer-machine');

  export default {
    props: ['stopped'],

    mounted: function() {
      setInterval(() => {
        this.secondsPassed = this.countdown > 0
          ? Math.max(this.countdown - (this.timer.time() / 1000), 0) 
          : (this.timer.time() / 1000);
      }, 200);
    },

    data: () => ({
      timer: new Timer(),
      secondsPassed: 0,
      countdown: 0,
      timeLimit: 0
    }),

    methods: {
      reset: function(seconds, limit) {
        this.secondsPassed = 0;
        this.countdown = seconds || 0;
        this.timeLimit = limit || 0;
        this.timer = new Timer();
      },

      setTimeLimit: function(limit){
        this.timeLimit = limit || 0;
      } 
    },

    filters: {
      formatTime: value => {
        const prependZero = num => (num < 10) ? `0${num}`: `${num}`;
        const totalSeconds = parseInt(value, 10);

        let minutes = prependZero(Math.floor(totalSeconds / 60));
        let seconds = prependZero(totalSeconds - (minutes * 60));

        return `${minutes}:${seconds}`;
      },
    },

    watch : {
      stopped : function (stopped) {
        this.timer[stopped ? 'stop' : 'start']();
      }
    }
  }
</script>

<style lang="scss" type="text/scss">
  .audio-recorder-timer {
    font-family: 'Open Sans', sans-serif;
    font-size: 1.5em;
    font-weight: 600;
    color: #8f8f8f;
    margin: 1em 0;
  }
  .audio-recorder-timer .time-limit:before{
    content: "/\00a0";
    margin-left: "3px"
  }
</style>
