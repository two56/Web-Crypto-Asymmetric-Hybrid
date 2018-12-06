const fs = require('fs');
const url = require('url');
const https = require('https');
const crypto = require('crypto');
const {StringDecoder} = require('string_decoder');

var publicKey = '';

function addToByteArray(array, data) {
	const byteLength = array.byteLength;
	const byteArray = new Uint8Array(byteLength + Uint32Array.BYTES_PER_ELEMENT + data.byteLength);
	byteArray.set(array);
	byteArray.set(new Uint8Array((new Uint32Array([data.byteLength])).buffer), byteLength);
	byteArray.set(data, byteLength + Uint32Array.BYTES_PER_ELEMENT);
	return byteArray;
}

const serverHTTP = https.createServer(
	{
		key:	fs.readFileSync('key.pem'),
		cert:	fs.readFileSync('certificate.pem')
	},
	(request, response) => {
		if ( request.method == 'GET' ) {
			let pathName = url.parse(request.url).pathname.substr(1);
			if ( ! pathName.length )
				pathName = 'index.html';
			fs.readFile('html/' + pathName,
				async (err, data) => {
					if ( err ) {
						response.writeHead(404, {'Content-type': 'text/plan'});
						response.write('Not Found');
						response.end();
					} else {
						if ( pathName.includes('mp3/') ) {
							const AESIv = crypto.randomBytes(16);
							const AESKey = crypto.randomBytes(32);
							const cipher = crypto.createCipheriv('aes-256-cbc', AESKey, AESIv);
							const encryptedKey = crypto.publicEncrypt(publicKey, AESKey);
							const encryptedFile = Buffer.concat([cipher.update(data), cipher.final()]);
							let byteArray = new Uint8Array();
							byteArray = addToByteArray(byteArray, encryptedKey);
							byteArray = addToByteArray(byteArray, AESIv);
							byteArray = addToByteArray(byteArray, encryptedFile);
							data = Buffer.from(byteArray);
						}
						response.writeHead(200);
						response.write(data);
						response.end();
					}
				}
			);
		} else if ( request.method == 'POST' ) {
			var publicPEM = '';
			request.on('data',
				(data) => {
					publicPEM += data.toString(); 
				}
			);
			request.on('end',
				() => {
					publicKey = publicPEM;
				}
			);
			response.writeHead(200);
			response.write(JSON.stringify({success: true}));
			response.end();
		}
	}
).listen(8443);
