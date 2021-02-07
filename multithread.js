export default class MultiThread {
  constructor (threads) {
    const URL = window.URL || window.webkitURL;

    if (!URL) {
      throw new Error('This browser does not support Blob URLs');
    }

    if (!window.Worker) {
      throw new Error('This browser does not support Web Workers');
    }

    this._threads = Math.max(2, threads || 0);
    this._queue = [];
    this._queueSize = 0;
		this._activeThreads = 0;
		this._debug = {
			start: 0,
			end: 0,
			time: 0
		};

		if (!('MultiThread' in window)) {
			const _threads = this._threads;

      window.MultiThread = new MultiThread(_threads);
    }
  }

  static worker = {
    JSON: function () {
      let /**/name/**/ = (/**/func/**/);

			self.addEventListener('message', e => {
				let data = e.data;
				let view = new DataView(data);
				let len = data.byteLength;
				let str = Array(len);

        for (let i = 0; i < len; i++) {
					str[i] = String.fromCharCode(view.getUint8(i));
				}

        const args = JSON.parse(str.join(''));
				const value = (/**/name/**/).apply(/**/name/**/, args);

				try {
					data = JSON.stringify(value);
				} catch(e) {
					throw new Error('Parallel function must return JSON serializable response');
				}

        len = typeof(data) === undefined ? 0 : data.length;

				const buffer = new ArrayBuffer(len);

				view = new DataView(buffer);

        for (i = 0; i < len; i++) {
					view.setUint8(i, data.charCodeAt(i) & 255);
				}

        self.postMessage(buffer, [buffer]);
				self.close();
			})
    },
    Int32: function () {
      let /**/name/**/ = (/**/func/**/);

			self.addEventListener('message', e => {
				let data = e.data;
				let view = new DataView(data);
				let len = data.byteLength / 4;
				let arr = Array(len);

				for (let i = 0; i < len; i++) {
					arr[i] = view.getInt32(i*4);
				}

				let value = (/**/name/**/).apply(/**/name/**/, arr);

        if (!(value instanceof Array)) {
          value = [value];
        }

        len = value.length;

        const buffer = new ArrayBuffer(len * 4);

        view = new DataView(buffer);

        for (i = 0; i < len; i++) {
					view.setInt32(i * 4, value[i]);
				}

				self.postMessage(buffer, [buffer]);
				self.close();
			})
    },
    Float64: function () {
      let /**/name/**/ = (/**/func/**/);

			self.addEventListener('message', e => {
				let data = e.data;
				let view = new DataView(data);
				let len = data.byteLength / 8;
				let arr = Array(len);

				for (let i = 0; i < len; i++) {
					arr[i] = view.getFloat64(i*8);
				}

				let value = (/**/name/**/).apply(/**/name/**/, arr);

        if (!(value instanceof Array)) {
          value = [value];
        }

        len = value.length;

        const buffer = new ArrayBuffer(len * 8);

        view = new DataView(buffer);

        for (i = 0; i < len; i++) {
					view.setFloat64(i * 8, value[i]);
				}

        self.postMessage(buffer, [buffer]);
				self.close();
			})
    }
  };

  static encode = {
    JSON: function (args) {
      let data = null;

      try {
				data = JSON.stringify(args);
			} catch(e) {
				throw new Error('Arguments provided to parallel function must be JSON serializable');
			}

      len = data.length;

      const buffer = new ArrayBuffer(len);
			const view = new DataView(buffer);

			for (let i = 0; i < len; i++) {
				view.setUint8(i, data.charCodeAt(i) & 255);
			}

			return buffer;
    },
    Int32: function (args) {
      len = args.length;

			const buffer = new ArrayBuffer(len * 4);
			const view = new DataView(buffer);

      for (let i = 0; i < len; i++) {
				view.setInt32(i*4, args[i]);
			}

			return buffer;
    },
    Float64: function (args) {
      len = args.length;

			const buffer = new ArrayBuffer(len * 8);
			const view = new DataView(buffer);

			for (let i = 0; i < len; i++) {
				view.setFloat64(i*8, args[i]);
			}

			return buffer;
    }
  };

  static decode = {
    JSON: function (data) {
      const view = new DataView(data);
			const len = data.byteLength;
			let str = Array(len);

			for (let i = 0; i < len; i++) {
				str[i] = String.fromCharCode(view.getUint8(i));
			}

			if (!str.length) {
				return;
			} else {
				return JSON.parse(str.join(''));
			}
    },
    Int32: function (data) {
      const view = new DataView(data);
			const len = data.byteLength / 4;
			let arr = Array(len);

			for (let i = 0; i < len; i++) {
				arr[i] = view.getInt32(i * 4);
			}

			return arr;
    },
    Float64: function (data) {
      const view = new DataView(data);
			const len = data.byteLength / 8;
			let arr = Array(len);

			for (let i = 0; i < len; i++) {
				arr[i] = view.getFloat64(i * 8);
			}

			return arr;
    }
  };

  execute (resource, args, type, callback) {
    const t = (new Date()).valueOf();

    if (!this._activeThreads) {
			this._debug.start = t;
		}

		if (this._activeThreads < this._threads) {
			this._activeThreads++;

      let listener = null;

			const worker = new Worker(resource);
			const buffer = this.encode[type](args);
			const decode = this.decode[type];
			const self = this;

      if (type === 'JSON') {
				listener = e => {
					callback.call(self, decode(e.data));
					self.ready();
				};
			} else {
				listener = e => {
					callback.apply(self, decode(e.data));
					self.ready();
				};
			}

			worker.addEventListener('message', listener);
			worker.postMessage(buffer, [buffer]);
		} else {
			this._queueSize++;
			this._queue.push([resource, args, type, callback]);
		}
  }

  ready () {
    this._activeThreads--;

		if (this._queueSize) {
			this.execute.apply(this, this._queue.shift());
			this._queueSize--;
		} else if (!this._activeThreads) {
			this._debug.end = (new Date).valueOf();
			this._debug.time = this._debug.end - this._debug.start;
		}
  }

  prepare (fn, type) {
    fn = fn;

		let name = fn.name;
		const fnStr = fn.toString();

		if (!name) {
			name = '$' + ((Math.random() * 10) | 0);

			while (fnStr.indexOf(name) !== -1) {
				name += ((Math.random() * 10) | 0);
			}
		}

		const script = this.worker[type]
			.toString()
			.replace(/^.*?[\n\r]+/gi, '')
			.replace(/\}[\s]*$/, '')
			.replace(/\/\*\*\/name\/\*\*\//gi, name)
			.replace(/\/\*\*\/func\/\*\*\//gi, fnStr);

		const resource = URL.createObjectURL(
      new Blob(
        [script],
        { type: 'text/javascript' }
      )
    );

		return resource;
  }

  process (fn, callback) {
    const resource = this.prepare(fn, 'JSON');
		const self = this;

		return function () {
			self.execute(
        resource,
        [].slice.call(arguments),
        'JSON',
        callback
      )
		};
  }

  processInt32 (fn, callback) {
    const resource = this.prepare(fn, 'Int32');
		const self = this;

		return function () {
			self.execute(
        resource,
        [].slice.call(arguments),
        'Int32',
        callback
      )
		};
  }

  processFloat64 (fn, callback) {
    const resource = this.prepare(fn, 'Float64');
		const self = this;

		return function () {
			self.execute(
        resource,
        [].slice.call(arguments),
        'Float64',
        callback
      )
		};
  }
}
