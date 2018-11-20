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

		this._screenBuffer = Buffer.alloc((width * height) / 8).fill(0x00);
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
		rpio.msleep(0.01);
		this.reset();
		this.command(Buffer.from([this.DISPLAY_OFF]));
		this.command(Buffer.from([this.SET_DISPLAY_CLOCK_DIV, 0x80]));

		// Setup the right screen size
		if (this._screenHeight === 64) {
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

	invertDisplay() {
		this.command(Buffer.from([this.INVERT_DISPLAY]));
	}

	normalDisplay() {
		this.command(Buffer.from([this.NORMAL_DISPLAY]));
	}

	draw() {
		this.command(Buffer.from([this.SET_MEMORY_MODE, this.MEMORY_MODE_HORIZ]));
		this.command(Buffer.from([this.SET_PAGE_ADDRESS, 0x00, 0x07]));
		this.command(Buffer.from([this.SET_COL_ADDRESS, 0x00, 0x7f]));
		this.command(Buffer.from([this.DISPLAY_ON]));
		this.data(this._screenBuffer);
	}

	drawPixel(x, y, on) {
		if (x < 0 || x > this._screenWidth - 1 || y < 0 || y > this._screenHeight - 1) {
			return;
		}

		let page = Math.floor(y / 8);
		let offset = y % 8;
		
		if (on) {
			this._screenBuffer[page * this._screenWidth + x] |= (0x1 << offset);
		} else {
			this._screenBuffer[page * this._screenWidth + x] &= ((0x1 << offset) ^ 0xff);
		}
	}

	reset() {
		rpio.write(this._resetPin, rpio.LOW);
		rpio.msleep(10);
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