/* Licensed under the MIT License. */
import electron from 'electron';
import { readFileSync } from 'node:fs';
import { join } from '../../../base/common/path.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILogService } from '../../log/common/log.js';

export class GozappSplashScreen {
	private splashWindow: electron.BrowserWindow | null = null;
	private closed = false;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private static started = false;

	constructor(
		private readonly environmentMainService: IEnvironmentMainService,
		private readonly logService: ILogService,
	) {}

	shouldShow(): boolean {
		// Do not show splash for headless tasks, CLI outputs or tests
		if (this.environmentMainService.extensionTestsLocationURI) {
			return false;
		}
		const args = this.environmentMainService.args;
		if (args.help || args.version || args['status'] || args['wait'] || args['diff']) {
			return false;
		}
		return true;
	}

	show(): void {
		if (!this.shouldShow() || this.splashWindow || this.closed || GozappSplashScreen.started) {
			return;
		}
		GozappSplashScreen.started = true;
		try {
			const iconPath = join(this.environmentMainService.appRoot, 'resources/linux/code.png');
			const iconUrl = `data:image/png;base64,${readFileSync(iconPath).toString('base64')}`;
			const width = 220;
			const height = 220;
			this.splashWindow = new electron.BrowserWindow({
				width,
				height,
				show: false,
				frame: false,
				transparent: true,
				resizable: false,
				movable: false,
				center: true,
				skipTaskbar: true,
				hasShadow: false,
				focusable: false,
				alwaysOnTop: true,
				webPreferences: {
					sandbox: true,
					nodeIntegration: false,
					contextIsolation: true,
				}
			});
			const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
				html, body {
					margin: 0; padding: 0; width: 100%; height: 100%;
					display: flex; align-items: center; justify-content: center;
					background: transparent; overflow: hidden; user-select: none;
				}
				.splash-card {
					width: 180px; height: 180px;
					display: flex; align-items: center; justify-content: center;
					background: rgba(24, 24, 27, 0.92);
					border-radius: 28px;
					box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
					border: 1px solid rgba(255, 255, 255, 0.08);
				}
				img {
					width: 120px; height: 120px; object-fit: contain;
					filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
					animation: pulse 1.6s ease-in-out infinite alternate;
				}
				@keyframes pulse { from { opacity: 0.85; transform: scale(0.97); } to { opacity: 1; transform: scale(1.02); } }
			</style></head><body>
				<div class="splash-card"><img src="${iconUrl}" alt="Gozapp"></div>
			</body></html>`;
			this.splashWindow.once('ready-to-show', () => {
				if (!this.closed && this.splashWindow && !this.splashWindow.isDestroyed()) {
					this.splashWindow.show();
				}
			});
			void this.splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(error => {
				this.logService.warn('Gozapp splash failed to load', error);
				this.close();
			});
			// Fallback safety timeout so splash never stays orphaned.
			this.timer = setTimeout(() => this.close(), 8000);
		} catch (error) {
			this.logService.warn('GozappSplashScreen: unable to show splash', error);
			this.close();
		}
	}

	close(): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		clearTimeout(this.timer);
		if (this.splashWindow && !this.splashWindow.isDestroyed()) {
			try {
				this.splashWindow.destroy();
			} catch (error) {
				this.logService.warn('GozappSplashScreen: unable to close splash', error);
			}
			this.splashWindow = null;
		}
	}
}
