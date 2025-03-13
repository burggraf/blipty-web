<script lang="ts">
	import mpegts from 'mpegts.js';
	import videojs from 'video.js';
	import 'video.js/dist/video-js.css';
	import Button from './ui/button/button.svelte';
	import Info from 'lucide-svelte/icons/info';
	import { channelInfoRepository } from '$lib/repositories/channelinfo.repository';

	// Add type definitions at the top
	type ErrorType = string;
	type ErrorDetail = string;
	type MediaInfo = {
		mimeType?: string;
		duration?: number;
		width?: number;
		height?: number;
		[key: string]: any;
	};
	type Statistics = {
		decodedFrames: number;
		[key: string]: any;
	};

	let { src, channelId, providerId, streamId } = $props<{
		src: string;
		channelId?: number;
		providerId?: number;
		streamId?: string;
	}>();
	let videoId = $state(`video-${Math.random().toString(36).substring(2, 9)}`);
	let player = $state<mpegts.Player | null>(null);
	let vjsPlayer = $state<any>(null);
	let currentSrc = $state<string | null>(null);
	let isError = $state(false);
	let errorMessage = $state('');
	let videoElement = $state<HTMLVideoElement | null>(null);
	let isInitializing = $state(false);
	let isDestroying = $state(false);
	let playerContainer = $state<HTMLDivElement | null>(null);
	let needsReset = $state(false);
	let info = $state<MediaInfo | null>(null);
	let playbackSuccessful = $state(false);

	function destroyPlayer() {
		if (isDestroying) return;
		isDestroying = true;

		try {
			if (player) {
				try {
					player.pause();
					player.unload();
					player.detachMediaElement();
					player.destroy();
				} catch (error) {
					console.debug('Non-critical error during mpegts player cleanup:', error);
				}
				player = null;
			}

			if (vjsPlayer) {
				try {
					vjsPlayer.pause();
					vjsPlayer.dispose();
				} catch (error) {
					console.debug('Non-critical error during video.js cleanup:', error);
				}
				vjsPlayer = null;
			}

			// Reset video element
			if (videoElement) {
				try {
					videoElement.pause();
					videoElement.removeAttribute('src');
					videoElement.load();
				} catch (error) {
					console.debug('Non-critical error during video element cleanup:', error);
				}
			}
		} catch (error) {
			console.error('Error during player cleanup:', error);
		} finally {
			isDestroying = false;
		}
	}

	// Function to recreate the video element to ensure a clean state
	function recreateVideoElement() {
		if (!playerContainer) return;

		// Store the ID to reuse
		const id = videoId;

		// Remove the old video element
		if (videoElement) {
			// Check if videoElement is actually a child of playerContainer before removing
			if (videoElement.parentNode === playerContainer) {
				playerContainer.removeChild(videoElement);
			} else {
				// If the element isn't where we expect it, let's find it by ID instead
				const existingElement = document.getElementById(videoId);
				if (existingElement && existingElement.parentNode) {
					existingElement.parentNode.removeChild(existingElement);
				}
			}
		}

		// Create a new video element with the same attributes
		const newVideo = document.createElement('video');
		newVideo.id = id;
		newVideo.className = 'video-js vjs-big-play-button-centered vjs-fluid';
		newVideo.setAttribute('playsinline', '');
		newVideo.setAttribute('controls', '');
		newVideo.setAttribute('preload', 'auto');
		newVideo.setAttribute('crossorigin', 'anonymous');

		// Add the no-js message
		const noJsMessage = document.createElement('p');
		noJsMessage.className = 'vjs-no-js';
		noJsMessage.textContent =
			'To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video';
		newVideo.appendChild(noJsMessage);

		// Add the new video element to the container
		playerContainer.appendChild(newVideo);

		// Update the reference
		videoElement = newVideo;

		// Add error event listener
		videoElement.addEventListener('error', (e: Event) => {
			const error = videoElement?.error;
			if (error) {
				console.error('Video error:', {
					code: error.code,
					message: error.message || 'Unknown error'
				});
			}
		});

		console.log('Video element recreated with ID:', id);
	}

	// Function to update channel info in the database
	async function updateChannelInfo(status: string, mediaInfo?: MediaInfo) {
		if (!providerId || !streamId) {
			console.log('Cannot update channelinfo: missing providerId or streamId');
			return;
		}

		try {
			console.log(`Updating channelinfo for provider ${providerId}, stream ${streamId}`);

			// Get the existing channelinfo or create new if doesn't exist
			const channelInfo = (await channelInfoRepository.findByStreamId(providerId, streamId)) || {
				provider_id: providerId,
				stream_id: streamId,
				favorite: false,
				hidden: false,
				restricted: false
			};

			// Update fields
			const now = new Date();
			const updatedInfo = {
				...channelInfo,
				status,
				last_watched: now
			};

			// Add height and width if available from mediaInfo
			if (mediaInfo && status === 'OK') {
				if (mediaInfo.height) updatedInfo.height = mediaInfo.height;
				if (mediaInfo.width) updatedInfo.width = mediaInfo.width;
			}

			// Save to database
			if (channelInfo.id) {
				await channelInfoRepository.update(updatedInfo);
			} else {
				await channelInfoRepository.create(updatedInfo);
			}

			console.log('Successfully updated channelinfo');
		} catch (error) {
			console.error('Failed to update channelinfo:', error);
		}
	}

	async function initializePlayer() {
		if (isInitializing) {
			console.log('Player initialization already in progress, skipping...');
			return;
		}

		isInitializing = true;
		isError = false;
		errorMessage = '';
		playbackSuccessful = false;

		try {
			if (!videoElement) {
				throw new Error('Video element not found');
			}

			if (!mpegts.getFeatureList().mseLivePlayback) {
				throw new Error('MSE live playback not supported in this browser');
			}

			// First initialize mpegts.js with specific configuration for TS streams
			player = mpegts.createPlayer({
				type: 'mpegts', // Use mpegts type for .ts files
				isLive: true,
				url: src,
				cors: true,
				enableWorker: true,
				enableStashBuffer: false,
				stashInitialSize: 1024, // Increased buffer size
				liveBufferLatencyChasing: true,
				liveSync: true,
				lazyLoad: false,
				fixAudioTimestampGap: true,
				mediaDataSource: {
					isLive: true,
					cors: true,
					withCredentials: false
				}
			} as any); // Use type assertion as a workaround for TypeScript errors with mpegts.js

			if (!player) {
				throw new Error('Failed to create mpegts player');
			}

			// Set up error handling first
			player.on(mpegts.Events.ERROR, (errorType: ErrorType, errorDetail: ErrorDetail) => {
				console.error('mpegts.js error:', { type: errorType, detail: errorDetail, url: src });
				isError = true;
				errorMessage = `Stream error: ${errorType} - ${errorDetail}`;

				// Update channel info with error status
				if (providerId && streamId) {
					updateChannelInfo(`Error: ${errorType} - ${errorDetail}`);
				}
			});

			player.on(mpegts.Events.STATISTICS_INFO, (stats: Statistics) => {
				////console.debug('Stream stats:', stats);
				if (stats.decodedFrames > 0) {
					////console.log('Stream is decoding successfully');
				}
			});

			player.on(mpegts.Events.MEDIA_INFO, (mediaInfo: MediaInfo) => {
				console.debug('Media info:', mediaInfo);
				if (mediaInfo) {
					info = mediaInfo;
				}
			});

			// Initialize video element
			videoElement.crossOrigin = 'anonymous';

			// Attach media element before Video.js initialization
			console.log('Attaching media element to mpegts player...');
			player.attachMediaElement(videoElement);

			// Initialize Video.js with specific configuration
			vjsPlayer = videojs(videoElement, {
				controls: true,
				fluid: true,
				liveui: true,
				autoplay: true, // Enable autoplay
				preload: 'auto',
				html5: {
					vhs: {
						overrideNative: true
					},
					nativeVideoTracks: false,
					nativeAudioTracks: false,
					nativeTextTracks: false
				},
				techOrder: ['html5']
			});

			// Load the stream
			console.log('Loading stream...');
			await player.load();

			// Wait for the player to be ready
			await new Promise<void>((resolve, reject) => {
				const maxAttempts = 50; // 5 seconds timeout
				let attempts = 0;

				const checkReady = setInterval(() => {
					attempts++;
					if (player && videoElement) {
						if (videoElement.readyState >= 2) {
							clearInterval(checkReady);
							resolve();
						} else if (attempts >= maxAttempts) {
							clearInterval(checkReady);
							reject(new Error('Player initialization timed out'));
						}
					}
				}, 100);

				player.on(mpegts.Events.ERROR, (errorType: ErrorType, errorDetail: ErrorDetail) => {
					clearInterval(checkReady);
					reject(new Error(`Player error: ${errorType} - ${errorDetail}`));
				});
			});

			// Start playback
			console.log('Starting playback...');
			await player.play();

			// Monitor initial playback
			const playbackCheck = setInterval(() => {
				if (player && videoElement) {
					// Remove the direct getStatisticsInfo call and rely on the STATISTICS_INFO event
					if (videoElement.currentTime > 0) {
						console.log('Playback confirmed:', {
							currentTime: videoElement.currentTime,
							readyState: videoElement.readyState
						});

						// Mark playback as successful and update channel info
						playbackSuccessful = true;
						if (providerId && streamId) {
							updateChannelInfo('OK', info || undefined);
						}

						clearInterval(playbackCheck);
					}
				}
			}, 1000);

			// Clear the check after 10 seconds regardless
			setTimeout(() => {
				clearInterval(playbackCheck);
				// If playback hasn't been confirmed as successful by this point, update with a timeout error
				if (!playbackSuccessful && providerId && streamId) {
					updateChannelInfo('Error: Playback did not start within timeout period');
				}
			}, 10000);
		} catch (error: unknown) {
			console.error('Player initialization failed:', error);
			isError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to initialize video player';

			// Update channel info with error status
			if (providerId && streamId) {
				updateChannelInfo(`Error: ${errorMessage}`);
			}

			destroyPlayer();
		} finally {
			isInitializing = false;
		}
	}

	async function handleSourceChange(newSrc: string) {
		if (newSrc === currentSrc) return;
		console.log('Source changed from', currentSrc, 'to', newSrc);

		currentSrc = newSrc;

		// Reset playback success state for new source
		playbackSuccessful = false;

		// Complete cleanup first
		destroyPlayer();

		// Recreate video element to ensure clean state when switching sources
		recreateVideoElement();

		// Ensure cleanup is complete before initializing new player
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Initialize new player
		if (newSrc && videoElement) {
			await initializePlayer();
		}
	}

	// Mount logic
	let mounted = $state(false);
	$effect(() => {
		if (!mounted) {
			mounted = true;
			setTimeout(() => {
				videoElement = document.getElementById(videoId) as HTMLVideoElement;
				// Get reference to the player container for video element recreation
				playerContainer = document.querySelector('.video-wrapper') as HTMLDivElement;

				if (videoElement) {
					console.log('Video element mounted successfully');
					videoElement.addEventListener('error', (e: Event) => {
						const error = videoElement?.error;
						if (error) {
							console.error('Video error:', {
								code: error.code,
								message: error.message || 'Unknown error'
							});
						}
					});
					// Start playback immediately if we have a source
					if (src) {
						handleSourceChange(src);
					}
				} else {
					console.error('Failed to find video element');
				}
			}, 0);
		}
	});

	$effect(() => {
		if (src) {
			console.log('Source changed to:', src);
			handleSourceChange(src);
		}
	});

	// Cleanup
	$effect(() => {
		return () => {
			destroyPlayer();
		};
	});
	const toggleInfo = () => {
		const infoEl = document.getElementById('info');
		if (infoEl) {
			infoEl.style.display = infoEl.style.display === 'none' ? 'block' : 'none';
		}
	};
</script>

<div class="video-wrapper">
	{#if isError}
		<div class="error-message">
			<p>{errorMessage}</p>
		</div>
	{/if}

	<video
		id={videoId}
		class="video-js vjs-big-play-button-centered vjs-fluid"
		playsinline
		controls
		preload="auto"
		crossorigin="anonymous"
	>
		<track kind="captions" src="" srclang="en" label="English captions" default />
		<p class="vjs-no-js">
			To view this video please enable JavaScript, and consider upgrading to a web browser that
			supports HTML5 video
		</p>
	</video>
</div>
<div id="info" style="display: none;">
	{#if info}
		<pre>{JSON.stringify(info, null, 2)}</pre>
	{/if}
</div>
<Button variant="ghost" size="icon" onclick={toggleInfo}>
	<Info class="h-4 w-4" />
	<span class="sr-only">Add Provider</span>
</Button>

<style>
	.video-wrapper {
		width: 100%;
		height: 100%;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	:global(.video-js) {
		width: 100% !important;
		height: 100% !important;
		aspect-ratio: 16 / 9;
	}

	:global(.video-js .vjs-tech) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.error-message {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		padding: 1.5rem;
		border-radius: 0.5rem;
		text-align: center;
		color: white;
		z-index: 1000;
	}

	.play-button {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 1rem 2rem;
		font-size: 1.2rem;
		background: rgba(255, 255, 255, 0.9);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		z-index: 1000;
		transition: background-color 0.2s;
	}

	.play-button:hover {
		background: white;
	}
</style>
