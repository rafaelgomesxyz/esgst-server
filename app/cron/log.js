const fs = require('fs');
const path = require('path');

const gamesLog = fs.readFileSync(path.resolve(__dirname, './games.log'), 'utf8');
const rcvLog = fs.readFileSync(path.resolve(__dirname, './rcv_sgtools.log'), 'utf8');
const rncvLog = fs.readFileSync(path.resolve(__dirname, './rncv_sg.log'), 'utf8');
const sgidsLog = fs.readFileSync(path.resolve(__dirname, './sgids.log'), 'utf8');
const uhLog = fs.readFileSync(path.resolve(__dirname, './uh.log'), 'utf8');

console.log(gamesLog);
console.log(rcvLog);
console.log(rncvLog);
console.log(sgidsLog);
console.log(uhLog);
