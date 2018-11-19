const rpio = require("rpio");

class SSD1306 {
	constructor ({ width, height, resetPin, dcPin, spiChip, rpio }) {
		this.EXTERNAL_VCC   = 0x1
		this.SWITCH_CAP_VCC = 0x2

		this.SET_LOW_COLUMN        = 0x00
		this.SET_HIGH_COLUMN       = 0x10
		this.SET_MEMORY_MODE       = 0x20
		this.SET_COL_ADDRESS       = 0x21
		this.SET_PAGE_ADDRESS      = 0x22
		this.RIGHT_HORIZ_SCROLL    = 0x26
		this.LEFT_HORIZ_SCROLL     = 0x27
		this.VERT_AND_RIGHT_HORIZ_SCROLL = 0x29
		this.VERT_AND_LEFT_HORIZ_SCROLL = 0x2A
		this.DEACTIVATE_SCROLL     = 0x2E
		this.ACTIVATE_SCROLL       = 0x2F
		this.SET_START_LINE        = 0x40
		this.SET_CONTRAST          = 0x81
		this.CHARGE_PUMP           = 0x8D
		this.SEG_REMAP             = 0xA0
		this.SET_VERT_SCROLL_AREA  = 0xA3
		this.DISPLAY_ALL_ON_RESUME = 0xA4
		this.DISPLAY_ALL_ON        = 0xA5
		this.NORMAL_DISPLAY        = 0xA6
		this.INVERT_DISPLAY        = 0xA7
		this.DISPLAY_OFF           = 0xAE
		this.DISPLAY_ON            = 0xAF
		this.COM_SCAN_INC          = 0xC0
		this.COM_SCAN_DEC          = 0xC8
		this.SET_DISPLAY_OFFSET    = 0xD3
		this.SET_COM_PINS          = 0xDA
		this.SET_VCOM_DETECT       = 0xDB
		this.SET_DISPLAY_CLOCK_DIV = 0xD5
		this.SET_PRECHARGE         = 0xD9
		this.SET_MULTIPLEX         = 0xA8

		this.MEMORY_MODE_HORIZ = 0x00
		this.MEMORY_MODE_VERT  = 0x01
		this.MEMORY_MODE_PAGE  = 0x02

		let options = {
			gpiomem: false,
			mapping: "gpio",
			...rpio
		};

		this._screenWidth = width;
		this._screenHeight = height;
		this._resetPin = resetPin;
		this._dcPin = dcPin;
		this._spiChip = spiChip;

		this._rpioOptions = options;

		this._screenBuffer = Buffer.alloc((width * height) / 8);

		for (let i = 0; i < this._screenBuffer.length; i++) {
			switch (i % 3) {
				case 0:
					this._screenBuffer[i] = 0b01001001;
				break;
				case 1:
					this._screenBuffer[i] = 0b10010010;
				break;
				case 2:
					this._screenBuffer[i] = 0b00100100;
				break;
			}
		}
	}

	init() {
		rpio.init(this._rpioOptions);
		rpio.spiBegin();
		rpio.spiChipSelect(this._spiChip);
		// 8MHz
		rpio.spiSetClockDivider(128);

		rpio.open(this._resetPin, rpio.OUTPUT, rpio.HIGH);
		rpio.open(this._dcPin, rpio.OUTPUT, rpio.LOW);

		// Init the OLED screen
		rpio.sleep(0.001);
		this.reset();
		this.command(Buffer.from([this.DISPLAY_OFF]));
		this.command(Buffer.from([this.SET_DISPLAY_CLOCK_DIV, 128]));

		// Setup the right screen size
		if (this.height === 64) {
			this.command(Buffer.from([this.SET_MULTIPLEX, 0x3F]));
			this.command(Buffer.from([this.SET_COM_PINS, 0x12]));
		} else {
			this.command(Buffer.from([this.SET_MULTIPLEX, 0x1F]));
			this.command(Buffer.from([this.SET_COM_PINS, 0x02]));
		}

		this.command(Buffer.from([this.SET_DISPLAY_OFFSET, 0x00]));
		this.command(Buffer.from([this.SET_START_LINE | 0x00]));
		this.command(Buffer.from([this.CHARGE_PUMP, 0x14]));
		this.command(Buffer.from([this.SET_MEMORY_MODE, 0x00]));
		this.command(Buffer.from([this.SEG_REMAP | 0x01]));
		this.command(Buffer.from([this.COM_SCAN_DEC]));
		this.command(Buffer.from([this.SET_CONTRAST, 0x8f]));
		this.command(Buffer.from([this.SET_PRECHARGE, 0xf1]));
		this.command(Buffer.from([this.SET_VCOM_DETECT, 0x40]));
		this.command(Buffer.from([this.DISPLAY_ALL_ON_RESUME]));
		this.command(Buffer.from([this.NORMAL_DISPLAY]));
		this.command(Buffer.from([this.DISPLAY_ON]));
	}

	clearDisplay() {
		this._screenBuffer.fill(0);
	}

	draw() {
		let pageCount = this._screenHeight / 8;
		this.command(Buffer.from([this.SET_MEMORY_MODE, this.MEMORY_MODE_VERT]));
		this.command(Buffer.from([this.SET_PAGE_ADDRESS, 0, pageCount - 1]));
		this.command(Buffer.from([this.SET_COL_ADDRESS, 0, this._screenWidth - 1]));
		this.data(this._screenBuffer);
	}

	reset() {
		rpio.write(this._resetPin, rpio.LOW);
		rpio.sleep(0.01);
		rpio.write(this._resetPin, rpio.HIGH);
	}

	command(buffer) {
		rpio.spiWrite(buffer, buffer.length);
	}

	data(buffer) {
		// Set DC to high to write data
		rpio.write(this._dcPin, rpio.HIGH);

		rpio.spiWrite(buffer, buffer.length);

		rpio.write(this._dcPin, rpio.LOW);
	}

	end() {
		rpio.spiEnd();
		rpio.close(this._resetPin, rpio.PIN_RESET);
		rpio.close(this._dcPin, rpio.PIN_RESET);
	}
}

module.exports = SSD1306;