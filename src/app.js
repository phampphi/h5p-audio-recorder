import Recorder from 'components/Recorder';
import State from 'components/State';
import Vue from 'vue';
import AudioRecorderView from './views/AudioRecorder.vue';
import Timer from './views/Timer.vue';
import VUMeter from './views/VUMeter.vue';
import moment from 'moment';
import Swal from 'sweetalert2';

const AUDIO_SRC_NOT_SPECIFIED = '';

export default class {

  /**
   * @typedef {Object} Parameters
   *
   * @property {string} title Title
   * @property {Object} l10n Translations
   * @property {string} l10n.download Download button text
   * @property {string} l10n.retry Retry button text
   * @property {string} l10n.finishedRecording Done recording audio
   * @property {string} l10n.microphoneInaccessible Microphone blocked
   * @property {string} l10n.downloadRecording Download recording message
   */

  /**
   * @constructor
   *
   * @param {Parameters} params Content type parameters
   * @param {string} contentId
   * @param {object} contentData
   */
  constructor(params, contentId, contentData) {
    const rootElement = document.createElement('div');
    rootElement.classList.add('h5p-audio-recorder');

    const recorder = this.recorder = new Recorder();

    let previousState = contentData.previousState;

    let answered = false;
    let audioRecordingFile = !!previousState ? previousState.audioRecordingFile : null;
    let userAnswerBase64 = !!previousState ? previousState.userAnswerBase64 : null;

    let readyMsg = params.l10n.statusReadyToRecord;
    if (params.startRecordingDelays > 0 && params.audioFile === undefined)
      readyMsg = params.l10n.statusReadyAndAutoRecord + ' in ' + params.startRecordingDelays + ' seconds.';
    else if (params.startRecordingDelays > 0 && params.audioFile !== undefined)
      readyMsg = params.l10n.audioFinishesStartRecording + ' in ' + params.startRecordingDelays + ' seconds.';
    else if (params.audioFile !== undefined)
      readyMsg = params.l10n.statusReadyAndAutoRecord + ' ' + params.l10n.audioFinishes;
    const statusMessages = {};
    statusMessages[State.UNSUPPORTED] = params.l10n.microphoneNotSupported;
    statusMessages[State.BLOCKED] = params.l10n.microphoneInaccessible;
    statusMessages[State.READY] = readyMsg;
    statusMessages[State.PRE_RECORDING] = params.l10n.statusPreRecording;
    statusMessages[State.RECORDING] = params.l10n.statusRecording;
    statusMessages[State.PAUSED] = params.l10n.statusPaused;
    statusMessages[State.DONE] = params.l10n.statusFinishedRecording;
    statusMessages[State.INSECURE_NOT_ALLOWED] = params.l10n.insecureNotAllowed;
    statusMessages[State.CANT_CREATE_AUDIO_FILE] = params.l10n.statusCantCreateTheAudioFile;
    statusMessages[State.SOLUTION] = params.l10n.statusSolution;

    // Add supported for extra audio file.
    let audioFileSrc, solutionFileSrc;
    if (params.audioFile !== undefined && params.audioFile instanceof Object) {
      var file = params.audioFile[0]; 
      if (file && "audio/mpeg" === file.mime) {
        audioFileSrc = H5P.getPath(file.path, contentId);
      }
      else if (file && file.path.indexOf("https") == 0)
        audioFileSrc = file.path;
    }
    // Add supported for audio solution file.
    if (params.audioSolutionFile !== undefined && params.audioSolutionFile instanceof Object) {
      var file = params.audioSolutionFile[0]; 
      if (file && "audio/mpeg" === file.mime) {
        solutionFileSrc = H5P.getPath(file.path, contentId);
      }
      else if (file && file.path.indexOf("https") == 0)
        solutionFileSrc = file.path;
    }

    AudioRecorderView.data = () => ({
      title: params.title,
      state: recorder.supported() ? State.READY : State.UNSUPPORTED,
      statusMessages,
      l10n: params.l10n,
      audioFileSrc: !!audioFileSrc ? audioFileSrc : AUDIO_SRC_NOT_SPECIFIED,
      audioSrc: AUDIO_SRC_NOT_SPECIFIED,
      audioFilename: '',
      solutionFileSrc: !!solutionFileSrc ? solutionFileSrc : AUDIO_SRC_NOT_SPECIFIED,
      avgMicFrequency: 0,
      isAutoplay: params.autoplayAudioFile,
      canRetry: params.retry,
      canDownload: params.download,
      canPause: params.pause,
      canCheck: params.check,
      timeLimit: params.timeLimit,
      delayStart: params.startRecordingDelays,
      isEditor: params.isEditor,
      isActivated: false,
      uploadUrl: null
    });

    // Create recording wrapper view
    const viewModel = new Vue({
      ...AudioRecorderView,
      components: {
        timer: Timer,
        vuMeter: VUMeter
      }
    });

    // resize iframe on state change
    viewModel.$watch('state', () => this.trigger('resize'));

    // Start recording when record button is pressed
    viewModel.$on('recording', () => {
      recorder.start();
    });

    viewModel.$on('done', () => {
      answered = true;
      // Create a filename 
      const actor = this.createXAPIEventTemplate('audio').data.statement.actor.name;
      if (!!contentData && !!contentData.parent) {
        const filename = `${actor}-${contentData.parent.contentId}-${moment().format('YYYYMMDDhhmmssSSS')}.wav`;
        viewModel.audioFilename = filename.toLowerCase().replace(/ /g, '_');
      }
      else 
        viewModel.audioFilename = `${actor}-${moment().format('YYYYMMDDhhmmssSSS')}.wav`;

      if (!!params.uploadUrl) { // upload to storage service
        recorder.getWavData().then(e => {
          recorder.releaseMic();
          viewModel.audioSrc = URL.createObjectURL(e.data);

          // upload audio file for storage
          const formData = new FormData();
          formData.append('file', e.data, viewModel.audioFilename);
          fetch(params.uploadUrl, {method:"POST", body: formData})
              .then(response => {
                  if (response.ok) 
                    return response.json();
                  else 
                    throw Error(`Please contact adminstrator. There was an error while saving your audio answer: ${response.status}: ${response.statusText}`)
              })
              .then(data => audioRecordingFile = data.fileLocation)
              //.catch(err => Swal.fire('Recording Error', err.message, 'error'));
        }).catch(e => {
          //viewModel.state = State.CANT_CREATE_AUDIO_FILE;
          console.error(params.l10n.statusCantCreateTheAudioFile, e);
          this.storeAudioRecording();
        });
      }
      else { // store as base64
        this.storeAudioRecording();
      }
    });

    viewModel.$on('retry', () => {
      recorder.releaseMic();
      viewModel.audioSrc = AUDIO_SRC_NOT_SPECIFIED;
      this.startRecording();
    });

    viewModel.$on('paused', () => {
      recorder.stop();
    });

    viewModel.$on('solution', () => {
      this.trigger(this.getXAPIAnswerEvent());
    });

    // Update UI when on recording events
    recorder.on('recording', () => {
      viewModel.state = State.RECORDING;

      // Start update loop for microphone frequency
      this.updateMicFrequency();
    });

    // Blocked probably means user has no mic, or has not allowed access to one
    recorder.on('blocked', () => {
      viewModel.state = State.BLOCKED;
    });

    // May be sent from Chrome, which don't allow use of mic when using http (need https)
    recorder.on('insecure-not-allowed', () => {
      viewModel.state = State.INSECURE_NOT_ALLOWED;
    });

    /**
     * Store the audio recording as base64.
     */
    this.storeAudioRecording = function() {
      recorder.getWavData().then(e => {
        recorder.releaseMic();
        params.userAnswer = viewModel.audioSrc;
      
        var reader = new window.FileReader();
        reader.readAsDataURL(e.data);
        reader.onloadend = () => {
          userAnswerBase64 = reader.result;
          viewModel.audioSrc = userAnswerBase64;
        }
        
        this.trigger('resize');
      }).catch(e => {
        viewModel.state = State.CANT_CREATE_AUDIO_FILE;
        console.error(params.l10n.statusCantCreateTheAudioFile, e);
        Swal.fire('Recording Error', e.message, 'error')
      });
    }

    /**
     * Initialize microphone frequency update loop. Will run until no longer recording.
     */
    this.updateMicFrequency = function () {
      // Stop updating if no longer recording
      if (viewModel.state !== State.RECORDING) {
        window.cancelAnimationFrame(this.animateVUMeter);
        return;
      }

      // Grab average microphone frequency
      viewModel.avgMicFrequency = recorder.getAverageMicFrequency();

      // Throttle updating slightly
      setTimeout(() => {
        this.animateVUMeter = window.requestAnimationFrame(() => {
          this.updateMicFrequency();
        });
      }, 10)
    };

    /**
     * Attach library to wrapper
     *
     * @param {jQuery} $wrapper
     */
    this.attach = function ($wrapper) {
      $wrapper.get(0).appendChild(rootElement);
      viewModel.$mount(rootElement);
    }

    /**
     * Start recording automatically with delays as instructed in configuration.
     */
    this.startRecording = function () {
      (!params.isEditor && params.startRecordingDelays > 0) && viewModel.recordDelay();
    }

    /**
     * Stop the recording.
     */
    this.stop = function () {
      if (viewModel.state === State.RECORDING) viewModel.done();
      else if (viewModel.state === State.PLAYING) viewModel.stop();
      else viewModel.clearTimeouts();
    }

    /**
     * Invoke to perform autonomous actions.
     */
    this.activated = function () {
      if (params.isEditor) return;
      (params.autoplayAudioFile && params.audioFile !== undefined) 
        ? viewModel.playAudioFile() : this.startRecording();
    }

    /**
   * Checks if answer has been given.
   *
   * @returns {Boolean}
   */
    this.getAnswerGiven = function() {
      return answered;
    }

    this.getScore = function() {
      return 0;
    }

    this.getMaxScore = function() {
      return 1;
    }

    this.showSolutions = function() {
      viewModel.audioSrc = params.userAnswer;
      viewModel.state = State.SOLUTION;
    }

    /**
     * Build xAPI answer event.
     * @return {H5P.XAPIEvent} xAPI answer event.
     */
    this.getXAPIAnswerEvent = function () {
      const xAPIEvent = this.createXAPIEventTemplate('answered');
      const definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
      definition.name = {};
      // Fallback for h5p-php-reporting, expects en-US
      definition.name['en-US'] = this.getTitle();

      definition.description = {
        'en-US': params.title
      };
      definition.type = 'http://id.tincanapi.com/activitytype/essay';
      definition.interactionType = 'audio-recording';
      // Add title for h5p-php-reporting
      definition.extensions.title = definition.name['en-US'];

      xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this, true, true);
      xAPIEvent.data.statement.result.response = audioRecordingFile || userAnswerBase64;

      return xAPIEvent;
    };

    /**
    * Get xAPI data.
    * Contract used by report rendering engine.
    *
    * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
    */
    this.getXAPIData = function(){
      return {
        statement: this.getXAPIAnswerEvent().data.statement
      };
    };

    this.getTitle = function () {
      return H5P.createTitle((contentData.metadata && contentData.metadata.title) ? contentData.metadata.title : 'Audio Recording');
    };

    this.getCurrentState = function () {
      var state = previousState ? previousState : {};
      state.audioRecordingFile = audioRecordingFile;
      state.userAnswerBase64 = userAnswerBase64;
    
      return state;
    };
  }
}
