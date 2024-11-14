import React, {Component} from 'react';
import {HotKeys} from 'react-hotkeys';
import VideoControls from './VideoControls';
import VideoPlayer from './VideoPlayer';
import './index.css';
import SourceSelector from '../SourceSelector'
import SplitView from '../SplitView';
import TimeDisplay from './TimeDisplay';
import OffsetIndicator from './OffsetIndicator';
import {Help, HelpButton} from '../Help';
import {COMMANDS, KEY_MAP} from '../../keymap'
import {openFullscreen, isFullscreen, closeFullscreen} from "../../util/FullscreenUtils";
import {copyToClipboard} from "../../util/CopyClipboard";
import {FiPlay} from 'react-icons/fi';
import cx from 'classnames';
import {isHlsPlaylist} from "../../util/HlsUtils";
import {isDashOrHls, sourceType} from "../../util/SourceUtils";

const DEFAULT_SOURCES = {
    hls: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    dash: "https://dash.akamaized.net/dash264/TestCases/2a/qualcomm/1/MultiResMPEG2.mpd",
    av1: "https://storage.googleapis.com/bitmovin-demos/av1/stream.mpd"
};


const urlParams = new URLSearchParams(window.location.search);
const DEFAULT_SOURCE = DEFAULT_SOURCES[urlParams.get('defaultSource') ? urlParams.get('defaultSource') : 'hls'];
const leftVideoUrl = window.leftVideoUrl || urlParams.get('leftVideoUrl') || DEFAULT_SOURCE;
const rightVideoUrl = window.rightVideoUrl || urlParams.get('rightVideoUrl') || leftVideoUrl;
const leftVideoVariant = Number(urlParams.get('leftVideoVariant')) || 0;
const rightVideoVariant = Number(urlParams.get('rightVideoVariant')) || 0;
const startPosition = Number(urlParams.get('position')) || 0;
const hideSourceSelector = Boolean(urlParams.get('hideSourceSelector'));
const hideHelp = Boolean(urlParams.get('hideHelp'));

const DEFAULT_SOURCE_LEFT = {
    type: sourceType(leftVideoUrl),
    name: leftVideoUrl,
    url: leftVideoUrl,
    variant: leftVideoVariant,
    position: startPosition
};
const DEFAULT_SOURCE_RIGHT = {
    type:  sourceType(rightVideoUrl),
    name: rightVideoUrl,
    url: rightVideoUrl,
    variant: rightVideoVariant,
    position: startPosition
};

class VideoViewer extends Component {
    constructor(props) {
        super(props);
        this.setVideoViewerRef = videoViewer => {
            this.videoViewer = videoViewer;
        };
        this.setRightVideoRef = rightVideo => {
            console.log('setRightVideoRef', rightVideo);
            this.rightVideo = rightVideo;
        };
        this.setLeftVideoRef = leftVideo => {
            this.leftVideo = leftVideo;
        };
        this.setSplitViewRef = splitView => {
            this.splitView = splitView;
        };
        this.state = {
            playing: false,
            duration: 0,
            position: 0,
            leftSource: {name: "NONE", url: null, variant: leftVideoVariant},
            rightSource:{name: "NONE", url: null, variant: rightVideoVariant},
            tracking: true,
            splitBorderVisible: true,
            rightVideoOffset: 0,
            showHelp: !hideHelp,
            showSourceSelector: !hideSourceSelector,
            playReverse: false,
            userDefinedPanZoom: false
        };
        console.dir(this.state);

        this.onFullScreenChange = this.onFullScreenChange.bind(this);
    }

    setPosition(position) {
        this.setState({position});
    }

    setPlaying(playing) {
        this.setState({playing})
    }

    setLeftSource(leftSource) {
        this.setState({leftSource})
    }

    setRightSource(rightSource) {
        this.setState({rightSource})
    }

    toggleTracking() {
        this.setState({tracking: !this.state.tracking})
    }

    changeOffset(delta) {

        if(delta === 0) {
            this.setState({rightVideoOffset: delta});
        } else {
            this.setState({rightVideoOffset: this.state.rightVideoOffset + delta});
        }

        if (!this.state.playing) {
            this.seek(this.leftVideo.currentTime());
        } else {
            this.pause()
                .then(() => this.play())
        }
    }

    playPause() {
        if(this.state.playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    async step(steps) {
        const newTime = this.rightVideo.currentTime() + 0.04 * steps;
        this.rightVideo.quickSeek(newTime);
        this.leftVideo.quickSeek(newTime);
    }

    fullscreen() {
        if(isFullscreen()) {
            closeFullscreen();
        } else {
            openFullscreen(this.videoViewer);
        }
    }

    onTimeUpdate(time) {
        this.setPosition(time);
    }

    onDurationSet(duration) {
        this.setState({duration})
    }

    syncPlayers() {
        this.leftVideo.seek(this.rightVideo.currentTime());
        this.setPosition(this.leftVideo.currentTime());
    }

    async playForward() {
        if (this.state.playing) {
            await this.pause();
        }
        this.leftVideo.playbackRate = 1;
        this.rightVideo.playbackRate = 1;
        return this.play();
    }

    async play() {
        if(this.state.playing) {
            return Promise.resolve();
        }
        await Promise.all([this.rightVideo.play(), this.leftVideo.play()])
        this.setPlaying(true);

    }

    async createShareUrl() {
        if (this.state.leftSource.type === 'file' || this.state.rightSource.type === 'file') {
            alert("Shareable URL cannot be created since you are viewing a local file!");
        } else {
            const leftVariantParam = isDashOrHls(this.state.leftSource.type) ?
                `&leftVideoVariant=${this.state.leftSource.variant}` : "";
            const rightVariantParam = isDashOrHls(this.state.rightSource.type) ?
                `&rightVideoVariant=${this.state.rightSource.variant}` : "";
            const path = `${window.location.host}${window.location.pathname}?position=${this.state.position}`
            + `&leftVideoUrl=${this.state.leftSource.url}${leftVariantParam}`
            + `&rightVideoUrl=${this.state.rightSource.url}${rightVariantParam}`
            + (urlParams.get('hideSourceSelector') ? `&hideSourceSelector=${urlParams.get('hideSourceSelector')}` : "")
            + (urlParams.get('hideHelp') ? `&hideHelp=${urlParams.get('hideHelp')}` : "")
            console.log("Copying to clipboard: " + path);
            copyToClipboard(path)
        }
    }

    async pause() {
        if (!this.state.playing) {
            return Promise.resolve();
        }
        this.rightVideo.pause();
        this.leftVideo.pause();
        this.setPlaying(false);
        return this.seek(this.leftVideo.currentTime());
    }

    async seek(pos) {
        this.setState({position: pos});
        return Promise.all([this.leftVideo.seek(pos), this.rightVideo.seek(pos + this.state.rightVideoOffset * 0.04)]);
    }

    async onLeftVariantChange(variant) {
        console.log(`left variant changed: ${JSON.stringify(variant)}`);
        await this.changeVariant(this.leftVideo, variant)
    }

    async onRightVariantChange(variant) {
        console.log(`right variant changed: ${JSON.stringify(variant)}`);
        await this.changeVariant(this.rightVideo, variant)
    }

    async onLeftSourceChange(source) {
        await this.changeSource(this.leftVideo, source);
        this.setLeftSource(source);
        this.splitView.focus();
    }

    async onRightSourceChange(source) {
        await this.changeSource(this.rightVideo, source);
        this.setRightSource(source);
        this.splitView.focus();
    }

    async changeVariant(videoElement, variant) {
        this.pauseAndExecute(videoElement, async () => {
            this.setState({leftSource: Object.assign({}, this.state.leftSource, {variant})});
            await videoElement.setVariant(variant);
            //await this.step(0); // Seek to current time to improve dash switching time?
        });
    }

    async changeSource(videoElement, source) {
        console.log(`Change source ${source.url} ${source.variant}`);
        this.pauseAndExecute(videoElement, async () => {
            await videoElement.loadSource(source.url, source.variant);
        });
    }

    async pauseAndExecute(videoElement, action) {
        const wasPlaying = this.state.playing;
        const wasPlayingReverse = this.state.playReverse;
        await this.pause();
        const time = videoElement.currentTime();
        console.log(`${JSON.stringify(videoElement.props)} time: ${time}`);
        await action();
        await this.seek(time);
        if (wasPlaying) {
            await this.play();
        }
        if (wasPlayingReverse) {
            await this.playReverse();
        }
    }

    zoomIn() {
        this.leftVideo.zoomIn();
        this.rightVideo.zoomIn();
        this.setState({userDefinedPanZoom: true});
    }

    zoomOut() {
        this.leftVideo.zoomOut();
        this.rightVideo.zoomOut();
        this.setState({userDefinedPanZoom: true});
    }

    resetPanZoom() {
        this.leftVideo.resetPanZoom();
        this.rightVideo.resetPanZoom();
        this.setState({userDefinedPanZoom: false});
    }

    pan(deltaX, deltaY) {
        this.leftVideo.pan(deltaX, deltaY);
        this.rightVideo.pan(deltaX, deltaY);
        this.setState({userDefinedPanZoom: true});
    }

    shortCutHandlers = [
        [COMMANDS.STEP_FORWARD, () => this.step(25)],
        [COMMANDS.STEP_FORWARD_FRAME, () => this.step(1)],
        [COMMANDS.STEP_BACKWARD_FRAME, () => this.step(-1)],
        [COMMANDS.STEP_BACKWARD, () => this.step(-25)],
        [COMMANDS.PLAY_PAUSE, () => this.playPause()],
        [COMMANDS.FULLSCREEN, () => this.fullscreen()],
        [COMMANDS.TOGGLE_TRACKING, () => this.toggleTracking()],
        [COMMANDS.LEFT_ONLY, () => this.splitView.setSplitPosition(100)],
        [COMMANDS.RIGHT_ONLY, () => this.splitView.setSplitPosition(0)],
        [COMMANDS.TIMESHIFT_INCREASE, () => this.changeOffset(1)],
        [COMMANDS.TIMESHIFT_DECREASE, () => this.changeOffset(-1)],
        [COMMANDS.TIMESHIFT_RESET, () => this.changeOffset(0)],
        [COMMANDS.ZOOM_IN, () => this.zoomIn()],
        [COMMANDS.ZOOM_OUT, () => this.zoomOut()],
        [COMMANDS.PAN_UP, () => this.pan(0, 10)],
        [COMMANDS.PAN_DOWN, () => this.pan(0, -10)],
        [COMMANDS.PAN_RIGHT, () => this.pan(-10, 0)],
        [COMMANDS.PAN_LEFT, () => this.pan(10, 0)],
        [COMMANDS.REST_PAN_ZOOM, () => this.resetPanZoom()],
        [COMMANDS.SHARE, () => this.createShareUrl()],
        [COMMANDS.PLAY, () => this.playForward()],
        [COMMANDS.PAUSE, () => this.pause()],
        [COMMANDS.TOGGLE_HELP, () => this.toggleShowHelp()],
        [COMMANDS.TOGGLE_SPLIT_BORDER_VISIBLE, () => this.toggleSplitBorderVisible()]
    ].reduce((result, [command, action]) => Object.assign(result, {[command.name]: action}), {});

    toggleShowHelp() {
        this.setState({showHelp: !this.state.showHelp});
    }

    toggleSplitBorderVisible() {
        this.setState({splitBorderVisible: !this.state.splitBorderVisible});
    }

    onFullScreenChange() {
        if (!this.state.userDefinedPanZoom) {
            this.resetPanZoom();
        }
    }

    componentDidMount() {
        this.splitView.focus();
        this.seek(startPosition)
            .catch(e => console.trace(e));
        this.videoViewer.addEventListener('fullscreenchange', this.onFullScreenChange);
    }

    componentWillUnmount(){
        this.videoViewer.removeEventListener('fullscreenchange', this.onFullScreenChange);
    }

    render() {

        return (
            <div className="video-viewer"
                 tabIndex="0"
                 ref={this.setVideoViewerRef}>
                <TimeDisplay position={this.state.position}/>
                <HotKeys className="hotkeys-div" keyMap={KEY_MAP} handlers={this.shortCutHandlers}>
                    <SplitView tracking={this.state.tracking}
                               splitBorderVisible={this.state.splitBorderVisible}
                               onDrag={(dx,dy) => this.pan(dx,dy)}
                               onClick={() => this.playPause()}
                               ref={this.setSplitViewRef}
                               leftSideContent={(<VideoPlayer muted ref={this.setLeftVideoRef} />)}
                    >

                        <VideoPlayer ref={this.setRightVideoRef}
                                     onTimeUpdate={(time) => this.onTimeUpdate(time)}
                                     onDurationSet={(duration) => this.onDurationSet(duration)}
                        />
                        <div className={cx("big-play-button", {
                            "hidden": this.state.playing || this.state.position > 0.1
                        })}
                             onClick={() => this.play()}
                        >
                            <FiPlay size={32} fill="#f00" viewBox="-2 0 24 24" />
                        </div>
                    </SplitView>

                    <VideoControls visible={this.state.showSourceSelector}
                                   playing={this.state.playing}
                                   onPlay={() => this.playPause()}
                                   onStep={(n) => this.step(n)}
                                   onFullscreen={() => this.fullscreen()}
                                   duration={this.state.duration}
                                   onSeek={(pos) => this.seek(pos)}
                                   position={this.state.position}
                    />

                    <SourceSelector visible={this.state.showSourceSelector}
                                    className="left-source-selector"
                                    defaultSource={DEFAULT_SOURCE_LEFT}
                                    onChange={(value) => this.onLeftSourceChange(value)}
                                    onVariantChange={(value) => this.onLeftVariantChange(value)}/>
                    <SourceSelector visible={this.state.showSourceSelector}
                                    className="right-source-selector"
                                    defaultSource={DEFAULT_SOURCE_RIGHT}
                                    onChange={(value) => this.onRightSourceChange(value)}
                                    onVariantChange={(value) => this.onRightVariantChange(value)}/>
                    <OffsetIndicator offset={this.state.rightVideoOffset}/>
                    <Help visible={this.state.showHelp} onClick={() => this.toggleShowHelp()} />
                    <HelpButton onClick={() => this.toggleShowHelp()} />
                </HotKeys>
            </div>

        );
    }
}

export default VideoViewer;
