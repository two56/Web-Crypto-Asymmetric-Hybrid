var decryptKey;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function HttpRequest(url, options, data) {
	return new Promise(
		function(resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.responseType = options.response;
			xhr.open(options.method, url, true);
			xhr.onreadystatechange = function() {
				if ( xhr.readyState == XMLHttpRequest.DONE ) {
					if ( xhr.status == 200 || xhr.status == 0 )
						resolve(xhr.response);
					else
						reject();
				}
			};
			xhr.send(data);
		}
	);
}

async function generateRSA() {
	const {privateKey, publicKey} = await crypto.subtle.generateKey(
		{
			name:		'RSA-OAEP',
			modulusLength:	2048,
			publicExponent:	new Uint8Array([0x01, 0x00, 0x01]),
			hash: {
			 	name:	'SHA-1'
			}
		},
		true, 
		['encrypt', 'decrypt']
	);
	decryptKey = privateKey;	
	const publicSpki = await crypto.subtle.exportKey('spki', publicKey);
	let pemString = '-----BEGIN PUBLIC KEY-----\n';
	let string = btoa(String.fromCharCode(...new Uint8Array(publicSpki)));
	while ( string.length ) {
		pemString += string.substring(0, 64) + '\n';
		string = string.substring(64);
	}
	pemString += '-----END PUBLIC KEY-----';
	console.log('PUBLIC PEM:', pemString);
	await HttpRequest('https://localhost:8443', {method: 'POST', response: 'json'}, pemString);
}

function extractFromByteArray(array) {
	let offset = 0;
	const parts = [];
	while ( offset < array.byteLength ) {
		const length = (new Uint32Array(array, offset, Uint32Array.BYTES_PER_ELEMENT))[0];
		offset = offset + Uint32Array.BYTES_PER_ELEMENT;
		parts.push(new Uint8Array(array, offset, length));
		offset = offset + length;
	}
	return parts;
}

async function getMP3() {
	await generateRSA();
	const byteArray = await HttpRequest('https://localhost:8443/mp3/bensound-ukulele.mp3', {method: 'GET', response: 'arraybuffer'});
	const [encryptedKey, AESIv, encryptedData] = extractFromByteArray(byteArray);
	const AESRaw = await crypto.subtle.decrypt(
		{
			name:	'RSA-OAEP'
		},
		decryptKey,
		encryptedKey
	);
	const AESKey = await crypto.subtle.importKey('raw', AESRaw,
		{
			name:	'AES-CBC',
			length:	256
		},
		false,
		['encrypt', 'decrypt']
	);
	const data = await crypto.subtle.decrypt(
		{
			name:	'AES-CBC',
			iv:	AESIv
		},
		AESKey,
		encryptedData
	);
	document.querySelector('audio').src = URL.createObjectURL(new Blob([data], {type: 'audio/mpeg'}));
}

document.querySelector('button').addEventListener('click',
	(e) => {
		e.target.disabled = true;
		getMP3();
	}
);
