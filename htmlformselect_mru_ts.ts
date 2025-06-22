/**
 *  A jQuery plugin (now ported to TypeScript) that can provide two value-add services to
 *  html form select controls
 *  first optional service is alphabetical sorting via the labels text
 *  second optional service is 'mru' most-recently-used
 *  the web page user's most recently selected choices from that select list
 *  can be made to appear at the top of the list 
 * 
 *  Browser wrinkle observed: empty localStorage result differs in form between Brave Browser and Edge Browser
 
 */

interface DocumentFragment {
	// this stuff should not be neccesary.  It is to squelch bogus 'problem' complaints in vscode 
	getAttribute(attr: string): string;
	children: Array<DocumentFragment>;
	replaceChildren (fragment: DocumentFragment): any;
	addEventListener (eventname: string, callback: Function): any;
	appendChild (optionItem: HTMLOptionElement): any;
}

export class htmlformselect_mru {

	myoptions: any = {};
	mru_initial_state: any = {};		// this is populated once, before any sorting.
	//  However when it is needed to be used, it has the current (with sorting) state. Curious.
	mru_initial_state_valuestexts: any = {};

	constructor() {
		this.myoptions.verbose_debug = true; //false;
		this.myoptions.memoryPrefix = 'hfsmru_';
		this.myoptions.resetMRUCommand = "";

		// css class names to help visually differentiate which items in the options list were affected by mru
		this.myoptions.cssclass_mru_affected = "";
		this.myoptions.cssclass_not_mru_affected = "";
		this.myoptions.verbose_debug? console.log('htmlformselect_mru constructor invoked'): 0;
	}

	toArray(obj: any): any {
		var ii: number;
		var arr: Array<object> = [];
		for (ii = obj.length - 1; ii >= 0; ii--) {
			if (obj[ii].value == 'undefined') {
				console.log (ii, obj[ii].value);
			} else {
				//arr[ii] = obj[ii];
				arr.push (obj[ii]);
			}
		}
		return arr;
	}

	init(options: any) : any {

		this.myoptions.verbose_debug |= options.debug;
		this.myoptions.verbose_debug? console.log ('htmlformselect_mru_ts init running'): 0;
		var verbose_debug: any = this.myoptions.verbose_debug;

		if (typeof window !== 'undefined') {
			window.document.addEventListener('DOMContentLoaded', function (this: Document, ev: Event) {
				verbose_debug? console.log('htmlformselect_mru DOMContentLoaded is now triggered'): 0;
			});
			verbose_debug? console.log('htmlformselect_mru window.document.addEventListener("DOMContentLoaded" ... DONE'): 0;		
		} else {
			verbose_debug? console.log('htmlformselect_mru issue: window is undefined: use OnMount() event to invoke this'): 0;
		}

		// absorb option settings
		if (typeof options.memoryPrefix !== 'undefined') {
			this.myoptions.memoryPrefix = options.memoryPrefix;
		}
		if (typeof options.resetMRUCommand !== 'undefined') {
			this.myoptions.resetMRUCommand = options.resetMRUCommand;
		}
		if (typeof options.cssclass_mru_affected !== 'undefined') {
			this.myoptions.cssclass_mru_affected = options.cssclass_mru_affected;
		}
		if (typeof options.cssclass_not_mru_affected !== 'undefined') {
			this.myoptions.cssclass_not_mru_affected = options.cssclass_not_mru_affected;
		}

		this.myoptions.verbose_debug? console.log('htmlformselect_mru_ts init running "querySelectorAll(\'select[data-sortalpha]\'"'): 0;
		var sortAlphaTargets = document.querySelectorAll('select[data-sortalpha]') as NodeList;
		if (sortAlphaTargets.length > 0) {
			this.myoptions.verbose_debug? console.log('data-sortalpha targets: ', sortAlphaTargets): 0;
			[].forEach.call(sortAlphaTargets, (item: DocumentFragment) => {
					this.sortAlpha (item);
				}
			);
		}

		this.myoptions.verbose_debug? console.log('htmlformselect_mru_ts init running "querySelectorAll(\'select[data-sortmru]\'"'): 0;
		var sortMRUTargets = document.querySelectorAll('select[data-sortmru]')  as NodeList;
		if (sortMRUTargets.length > 0) {
			this.myoptions.verbose_debug? console.log('data-sortmru targets: ', sortMRUTargets): 0;
			[].forEach.call(sortMRUTargets, (item: DocumentFragment) => {
					this.sortMRU (item, this, this.myoptions);
				}
			);
		}
	}

	sortAlpha(domSelectElement: DocumentFragment) {
		var myId: string;
		myId = domSelectElement.getAttribute('id');
		if (typeof myId === 'undefined' || myId == null) {
			myId = domSelectElement.getAttribute('name');
		}

		var domSelectOptions = domSelectElement.children;
		var optionsArray: Array<HTMLCollection> = this.toArray(domSelectElement.children);

		var sortedOptions = optionsArray.sort(
			function (a: any, b: any) {
				return (a.text >= b.text) ? 1 : -1;
			}
		);

		// set them back into the original source select in a performant manner
		var fragment = document.createDocumentFragment();
		sortedOptions.forEach(
			function (option: any, index: number) {
				var opt = document.createElement('option');
				opt.innerHTML = option.text;
				opt.value = option.value;
				fragment.appendChild(opt);
			}
		);
		domSelectElement.replaceChildren (fragment as unknown as DocumentFragment);
	}

	sortMRU(domSelectElement: DocumentFragment, myoptions: any, install_click_event_listener: boolean = true) {
		var myId: string = domSelectElement.getAttribute('id');
		if (typeof myId === 'undefined' || myId == null) {
			myId = domSelectElement.getAttribute('name');
		}

		// preserve the initial state for possible re-instatement via resetMRUCommand
		if (typeof this.mru_initial_state [myId] === 'undefined' ) {
			this.mru_initial_state [myId] = domSelectElement.children;
			this.mru_initial_state_valuestexts [myId] = [];
			this.toArray (this.mru_initial_state [myId]).forEach ((item: HTMLOptionElement, index: number) => {
				this.mru_initial_state_valuestexts [myId][index] = { value: item.value, text: item.text };
			});
			this.myoptions.verbose_debug? console.log("hfsmru captured mru_initial_state for: ", myId): 0;
		}

		// get the MRU memory
		var storageName: string = this.myoptions.memoryPrefix + myId;
		myoptions.verbose_debug? console.log("hfsmru storage name: ", storageName): 0;
		var storedString: any = localStorage.getItem(storageName);
		var storedObject: any = {};

		if (storedString === null) {
			// EdgeBrowser, empty hfsmru
			storedString = '"{}"';	// make it look like Brave Browser result
		}
		if (storedString != '"{}"') {
			storedObject = JSON.parse(storedString);
		} else {
			storedObject = JSON.parse('{"-1": "-1"}');	// dummy entry because '{}' does not work in Brave Browser
		}

		var optionsArray: Array<HTMLCollection> = this.toArray(domSelectElement.children);
		
		if (myoptions.verbose_debug) {
			optionsArray.forEach(function (value: HTMLCollection, index: number) {
				 console.log(index, value);
				}
			);
		}

		// sort options on the basis of (possibly missing/null) mru time
		var sortedOptions = optionsArray.sort(
			function (a: any, b: any) {
				// where mrutime is 0 or equal, use the item index to detemine sort order
				// this is so it works in select option lists that are in some sense hierarchical rather than alphabetic
				var AbeforeB: boolean = true;
				var a_value: string = a.value;
				var b_value: string = b.value;
				var mruTimeA: number = parseInt(storedObject[a_value]);
				var mruTimeB: number = parseInt(storedObject[b_value]);
				mruTimeA = isNaN(mruTimeA) ? 0 : mruTimeA;
				mruTimeB = isNaN(mruTimeB) ? 0 : mruTimeB;

				if (a.value == 'undefined') {
					console.log ('UNDEFINED item found! in optionsArray.sort()');
				}

				if (mruTimeA == mruTimeB) {
					AbeforeB = (a.index > b.index);
					return AbeforeB ? 1 : -1;
				}
				AbeforeB = (mruTimeA < mruTimeB);
				return AbeforeB ? 1 : -1;
			}
		);

		// set them back into the original source select in a performant manner
		var fragment: HTMLSelectElement = document.createDocumentFragment() as unknown as HTMLSelectElement;
		var resetMRUCommand: string = myoptions.resetMRUCommand;
		sortedOptions.forEach(
			function (option: any, index: number) {
				var newopt: HTMLOptionElement = document.createElement('option');
				newopt.innerHTML = option.text;
				newopt.value = option.value;
				if (newopt.value == 'undefined') {
					console.log ('UNDEFINED item found!');
				}
				// set css class
				var mru_time: number = parseInt(storedObject[newopt.value]);
				mru_time = isNaN(mru_time) ? 0 : mru_time;
				if (mru_time != 0 && myoptions.cssclass_mru_affected != "") {
					newopt.classList.add (myoptions.cssclass_mru_affected);
				}
				if (mru_time == 0 && myoptions.cssclass_not_mru_affected != "") {
					newopt.classList.add (myoptions.cssclass_not_mru_affected);
				}

				if (newopt.value as string != resetMRUCommand) {
					fragment.appendChild(newopt);
				}
			}
		);

		// possibly add a reset command at the end
		if (sortedOptions.length > 0 && myoptions.resetMRUCommand != "" ) {
			var resetopt: HTMLOptionElement = document.createElement('option');
			resetopt.innerHTML = myoptions.resetMRUCommand;
			resetopt.value = myoptions.resetMRUCommand;
			fragment.appendChild(resetopt);
		}
		domSelectElement.replaceChildren (fragment as unknown as DocumentFragment);

		if (install_click_event_listener) {
			// hook up a 'select' listener to record mruTime
			domSelectElement.addEventListener ("click",
				async (event: PointerEvent) => {
					// record timestamp to memory 
					this.myoptions.verbose_debug? console.log('click detected on option: ', event): 0;

					var currentTarget: HTMLSelectElement = event.currentTarget as unknown as HTMLSelectElement;
					if (currentTarget != null) {

						var selectedValue = String(currentTarget.value);
						this.myoptions.verbose_debug? console.log('click selectedValue: ', selectedValue): 0;

						if (selectedValue == this.myoptions.resetMRUCommand) {
							localStorage.removeItem (storageName);
							storedObject = JSON.parse('{"-1": "-1"}');

							var newselectoptions: any = document.createDocumentFragment();
							this.myoptions.verbose_debug? console.log('mru_initial_state.length: ', this.mru_initial_state [myId].length): 0;

							var simple_options_array: Array<HTMLOptionElement>;
							simple_options_array = this.toArray (this.mru_initial_state_valuestexts [myId]);

							simple_options_array.forEach ((item: HTMLOptionElement, index: number) => {
								item.value = this.mru_initial_state_valuestexts [myId][index].value;
								item.text  = this.mru_initial_state_valuestexts [myId][index].text;
								var newitem: any = new Option (item.text, item.value);
								if (item.value != this.myoptions.resetMRUCommand) {
									this.myoptions.verbose_debug? console.log('adding: ', item.value, item.text): 0;
									newselectoptions.appendChild (newitem);
								}
							});

							domSelectElement.replaceChildren (newselectoptions);

							this.myoptions.verbose_debug? console.log('mru_initial_state.length: ', this.mru_initial_state [myId].length): 0;
							this.myoptions.verbose_debug? console.log('reset via "'+ this.myoptions.resetMRUCommand + '"'): 0;
							this.sortMRU(domSelectElement, this.myoptions, false);

						} else {
							storedObject[selectedValue] = Date.now();		// unixtimestamp
							localStorage.setItem(storageName, JSON.stringify(storedObject));
							this.myoptions.verbose_debug? console.log('memorized: ', JSON.stringify(storedObject)): 0;
							// reflect (display) the new state but 
							// do not install_click_event_listener: there already is one (i.e. this code block)
							this.sortMRU(domSelectElement, this.myoptions, false);
						}
					}
				}
			);
		}
	}
}
