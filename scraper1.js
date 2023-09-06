const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const progress = require('cli-progress');

const bar1 = new progress.SingleBar({},progress.Presets.shades_classic);
const currentDate = new Date();

// Get the individual components of the date
const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Add 1 because months are zero-indexed
const day = currentDate.getDate().toString().padStart(2, '0');
const year = currentDate.getFullYear().toString();

// Combine the components into the desired format
const formattedDate = `${month}${day}${year}`;

console.log('Formatted Date:', formattedDate);

let Email = '';
let Pass = '';
let stock_file = 'new';

function read(stock_file){
	let words = fs.readFileSync(`./${stock_file}`,'utf-8');
	return words.split('\n');
}
function convertToCSV(arr) {
		var quality = arr.find(item => item[0] === '1. Quality')[1];
		var valuation = arr.find(item => item[0] === '2. Valuation')[1];
		var priceTrend = arr.find(item => item[0] === '3. Price Trend')[1];
		return `\n\n ${arr[0][0]} : {  ${quality}, ${valuation}, ${priceTrend}   }`
}

(async() =>{
	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: false,
		userDataDir: './tmp'
	});
	const page = await browser.newPage();
	await page.goto('https://www.moneyworks4me.com/login/?from=menu',{
		waitUntil: 'load'
	});
	let current_url = await page.url();
	if (current_url == 'https://www.moneyworks4me.com/login/?from=menu'){
		await page.waitForSelector('#emailid');
		const email = await page.$('#emailid');
		if (email){
			
			await email.type(Email);
			const  password = await page.$('#password');

			await password.type(Pass);

			await page.click('button[class ="btn-block py-2 font-12rem text-white sign-up border-0"]');
		}
	}
	const stock_list = read(stock_file);
	bar1.start(stock_list.length,0);
	let count = 1;
	for (let stock of stock_list){
		count++;
		bar1.update(count);
		if (stock.length > 3){
			// pop_search box
			try{
				await page.waitForNavigation({timeout: 2000});
			}catch(error){
				//console.log(error);\
			}
			try{	
				await page.waitForSelector('#stocksearch-icon',{timeout:3000})
				await page.click('#stocksearch-icon');
			}catch (error){
			//	console.log(error);
				await page.click('#header-search-box');
			}
			await page.waitForSelector('input#popupsearch');
			let search_input = await page.$("input#popupsearch");
			await search_input.type(stock);
			
			var stock_name = "";
			var href;
			// this evaluates to href ,else null
			href = await page.evaluate(async (stock)=>{
				let arr = await document.getElementsByClassName('list-group-item text-left');
			//	console.log(arr);
				for (let inside of arr){
					if((inside.innerText).toLowerCase() == stock.toLowerCase()){
						stock_name = inside.innerText
						return inside.firstChild.href;
					}
				}
				return null;
			},stock)
			// href 
			if (href !== null){
				// selection through href
				var href_click = await page.waitForSelector(`a[href="${href}"]`,{visible: true});
				if (!href_click){
					// selection through stock_name
					href_click = await page.waitForXPath(`//a[contains(text(),"${stock_name}")]`, {visible: true});
				}
				await href_click.click();
				await page.waitForNavigation();

			}else{
				// alternative is directly searches the stock and nav through their

				let quote_search = await page.waitForSelector('button#quote_search');
			//	console.log(await quote_search.isVisible());
				await page.evaluate(()=>{
					let js = document.getElementById('quote_search');
					js.click()
				});

				await page.waitForSelector('#full-search-list');
				
				let match = await page.evaluate(async (stock)=>{
					
					let str = document.getElementById('full-search-list');
					for ( let name of str.innerText.split('\n')){
						if (stock.toLowerCase().includes(name.toLowerCase())){
							stock_name = name;
							return str.innerHTML;
						}
					}
					//string here.
					stock_name = stock;
					return str.innerHTML
				},stock)
				for (let li of match.split('<hr>')){
					//checks for stock name presence
					if ((li.toLowerCase()).includes(stock_name.toLowerCase())){
						href = li.slice(li.indexOf('/'),li.lastIndexOf('"'));
						var href_click = await page.waitForSelector(`a[href="${href}"]`,{visible: true});

						if (!(href_click)){
							href_click = await page.waitForXPath(`//a[contains(text(),"${stock_name}")]`, {visible: true});
						}
						await href_click.click();
						break;
						
					}
				}
				if (!(href)){
					console.log('not found');
				}else{
					await page.waitForNavigation();
					let checkFor = await page.$('div[class="card-body text-center"]');
					if (checkFor){
						let data = await page.evaluate(()=>{
							let sent_array = [];
							for (let dataIn of document.querySelectorAll('div[class="card-body text-center"]')){
								let inside = [];
								for (let x of dataIn.innerText.split('\n')){
									if (x == ''|| x==' ' ){
										continue;
									}
									inside.push(x);

								}
								sent_array.push(inside);

							}
							return sent_array;
						});
						data.unshift([stock]);	
						// Function to convert 2D array to CSV format
						// Convert your data to CSV format
						const csvData = convertToCSV(data);
					
						// Write the CSV data to a text file
						fs.appendFileSync(`${formattedDate}-data.txt`, csvData+'', 'utf8', (err) => {
								if (err) {
							console.error('Error writing to file:', err);
								} else {
							console.log('Data written to file successfully.');
								}
						})

					}
					
				}


			}
		}			
	}
	bar1.stop();
	await browser.close()
	
	
})();
