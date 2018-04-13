const Telegraf = require('telegraf');
const najax = require('najax');
const loadJsonFile = require('load-json-file');
const { JSDOM } = require('jsdom');
const child_process = require('child_process');
const _ = require('underscore');
const fs = require('fs');
const Cyberduck = require('./nodeCyberduck.js');
// const childProcess = require('child_process');
// const http = require('http');

require('dotenv').config(); // for apikeys

const cyberDuck = new Cyberduck(false);
const dictionary = loadJsonFile.sync('./samisDictionary.json');
const userDic = loadJsonFile.sync('./userDic.json');
const smileys = loadJsonFile.sync('./smileys.json');
const maxChars = 100;
const paradise = []; // contains a lot of paradisiac things
const googleCache = [];
let lastQuote; // cache the results of '/getquote <string>'
let wannaBuy;
let honhonhonpos = 1;
let honhonhoncache = [];

const invalidSize = str => str.length > maxChars;


const appendName = arr =>
    // transform ['test','b'] in ['test','test@botname','b','b@botname']
    _.flatten(_.map(arr, o => [o, `${o}@${process.env.BOT_NAME}`]));

const bot = new Telegraf(process.env.APIKEY_TELEGRAM);

bot.command(appendName(['witz', 'kicher']), ({ reply }) => najax({ url: 'http://witze.net/zuf%c3%a4llige-witze', type: 'GET' }).success(res => reply(new JSDOM(res).window.document.getElementsByClassName('joke')[0].textContent)));

const isAdmin = ctx => ctx.from.id == process.env.ADMIN;

bot.command(appendName(['restart']), (ctx) => {
	if (isAdmin(ctx)) {
		ctx.reply('Restarting bot...');
		throw 'Restart';
	}
});
bot.command(appendName(['uptime', 'up']), ({ replyWithMarkdown }) => child_process.exec('uptime', (err, stdout) => replyWithMarkdown(`\`\`\` ${stdout} \`\`\``)));
bot.command(appendName(['cow']), ({ replyWithMarkdown }) => child_process.exec('cowfortune', (err, stdout) => replyWithMarkdown(`\`\`\` ${stdout} \`\`\``)));
bot.command(appendName(['fortune']), ({ replyWithMarkdown }) => child_process.exec('fortune', (err, stdout) => replyWithMarkdown(`\`\`\` ${stdout} \`\`\``)));

bot.command(appendName(['honhonhon', 'blague']), ({ reply }) => {
    if (!honhonhoncache || !honhonhoncache[honhonhonpos]) {
        honhonhonpos = 0;
        najax({ url: 'https://www.blague-drole.net/blagues/bonne-blagues-hasard.html', type: 'GET' }).success((res) => {
            honhonhoncache = new JSDOM(res).window.document.getElementsByClassName('text-justify texte');
            honhonhonpos = 0;
        }).then(() => {
            reply(honhonhoncache[honhonhonpos++].textContent);
        });
    } else {
        reply(honhonhoncache[honhonhonpos++].textContent);
    }
});

bot.command(appendName(['lol']), ({ reply }) => najax({ url: 'http://jokes-best.com/random-jokes.php', type: 'GET' }).success(res => reply(new JSDOM(res).window.document.getElementsByClassName('joke')[0].textContent)));

bot.command(appendName(['getid']), (ctx) => {
    ctx.reply(`You are :${JSON.stringify(ctx.from)} from ${JSON.stringify(ctx.chat)}`);
});

bot.command(appendName(['getip']), (ctx) => {
    if (!isAdmin(ctx)) { return; }
    najax({ url: 'http://ipv6bot.whatismyipaddress.com/' }).success(r => ctx.replyWithMarkdown(`\`\`\`${r}\`\`\``));
});
bot.command(appendName(['start']), ({ reply }) => reply('Sasehashs fantastical Bot. Look me up on Github (https://github.com/samsumas/Funny-TelegramBot).\n\n btw it uses Arch ❤️'));


bot.command(appendName(['mensa']), ({ replyWithHTML }) => {
    najax({ url: `https://mensaar.de/api/1/${process.env.MENSA_KEY}/1/de/getMenu/sb` }).success((res) => {
        const json = JSON.parse(res);

        let returnText = 'Heute :🍽🍴\n';

        const day = json.days[0];

        _.each(day.counters, (counter) => {
            if (/Komplettmenü/.test(counter.displayName)) {
                returnText += '🅰️<b>Menü</b>\n';
            } else if (/Vegetarisches Menü/.test(counter.displayName)) {
                returnText += '🅱️<b>Menü</b>\n';
            } else if (/Free Flow/.test(counter.displayName)) {
                returnText += '<b>Freier Fluss</b>\n';
            } else if (/Mensacafé/.test(counter.displayName)) {
                returnText += `<b>${counter.displayName}☕️</b>\n`;
            } else {
                returnText += `<b>${counter.displayName}</b>\n`;
            }
            _.each(counter.meals, (meal) => {
                if (/Salatbuffet/.test(meal.name)) {
                    return;
                }
                returnText += `◾️ ${meal.name}`;
                _.each(smileys, (smiley) => {
                    const reg = new RegExp(`${smiley.name}`, 'i');
                    if (reg.test(meal.name)) {
                        returnText += ` ${smiley.emoji}`;
                    }
                });
                returnText += '\n';
                _.each(meal.components, (component) => {
                    returnText += `        ▪︎ ${component.name}`;
                    _.each(smileys, (smiley) => {
                        const reg = new RegExp(`${smiley.name}`, 'i');
                        if (reg.test(component.name)) {
                            returnText += ` ${smiley.emoji}`;
                        }
                    });
                    returnText += '\n';
                });
            });
        });
        replyWithHTML(returnText);
    });
});

const googleAPICall = (q, start, callback) => {
    najax({
        url: `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API}&cx=${process.env.GOOGLE_CSE}&q=${q}&prettyPrint=false&searchType=image&start=${start}`,
        type: 'GET',
    }).success(callback).error((err) => { throw JSON.stringify(err); });
};
const googleImageSearch = (q, ctx) => {
    if (!googleCache[q]) {
        googleAPICall(q, 1, (res) => {
            googleCache[q] = { json: JSON.parse(res), pos: 0, start: 1 };
            ctx.replyWithPhoto(googleCache[q].json.items[googleCache[q].pos++].link);
        });
    } else {
        const currPos = ++googleCache[q].pos;
        const val = googleCache[q].json.items[currPos];
        if (!val) {
            // loads next page
            googleCache[q].start = currPos + 1;
            googleCache[q].pos = 0;
            googleAPICall(q, googleCache[q].start, (res) => {
                googleCache[q].json = JSON.parse(res);
                ctx.replyWithPhoto(googleCache[q].json.items[googleCache[q].pos].link);
            });
        } else {
            ctx.replyWithPhoto(val.link);
        }
    }
};

bot.hears(new RegExp(`^/((google)|(image))(@${process.env.BOT_NAME})? (.*)`, 'i'), (ctx) => {
    if (ctx.match[5]) googleImageSearch(ctx.match[5], ctx);
});

bot.command(appendName(['wannabuy', 'buy']), ({ replyWithPhoto, reply }) => {
    if (wannaBuy) {
        wannaBuy = wannaBuy.nextElementSibling;
        if (!wannaBuy.firstElementChild.firstElementChild.nextElementSibling) { // if this is an ad, ignore it
            wannaBuy = wannaBuy.nextElementSibling;
        }
        let str = `${wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.firstElementChild.textContent}\n`; // title
        str += `(${wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.firstElementChild.firstElementChild.getAttribute('href')})`; // buy link
        str += wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.firstElementChild.textContent; // add short descr.
        str += '\nnext: /wannabuy';
        // replyWithPhoto(wannaBuy.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild.getAttribute("src"),{caption :str});
        const url = wannaBuy.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild.srcset.replace(/ .*/, '');
        replyWithPhoto({ url });
        reply(str);
    } else {
    // downloads the website, save it in wannaBuy, save first element in wannaBuy
        najax({
            url: 'https://awesomestufftobuy.com',
            type: 'GET',
        }).success((res) => {
            wannaBuy = new JSDOM(res).window.document.getElementById('masonry-loop').firstElementChild.nextElementSibling;
            if (wannaBuy) {
                let str = `${wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.firstElementChild.textContent}\n`; // title
                str += `(${wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.firstElementChild.firstElementChild.getAttribute('href')} )\n`; // buy link
                str += wannaBuy.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.firstElementChild.textContent; // add short descr.
                str += '\nnext: /wannabuy';
                const url = wannaBuy.firstElementChild.firstElementChild.firstElementChild.firstElementChild.firstElementChild.srcset.replace(/ .*/, '');
                replyWithPhoto({ url });
                reply(str);
            }
        });
    }
});


bot.hears(new RegExp(`^/(wecker)(@${process.env.BOT_NAME})? ([0-2]?[0-9]):([0-5][0-9]) ?(.*)`, 'i'), (ctx) => {
    const time = parseInt(ctx.match[3] * 60, 10) + parseInt(ctx.match[4], 10);
    const today = new Date();
    const todayMin = (today.getHours() * 60) + today.getMinutes();
    let wait = time - todayMin;
    if (time < todayMin) {
        wait = (1440 + time) - todayMin;
    }
    if (wait === 1) {
        ctx.reply(`${ctx.message.from.first_name}s Wecker klingelt in einer Minute`);
    } else {
        ctx.reply(`${ctx.message.from.first_name}s Wecker klingelt in ${wait} Minuten`);
    }
    setTimeout(() => { ctx.reply(`${ctx.message.from.first_name}s Wecker ${ctx.match[5]} klingelt!`); }, wait * 60 * 1000);
});

bot.hears(new RegExp(`^/(tea|tee|timer)(@${process.env.BOT_NAME})? ([0-9]*)`, 'i'), (ctx) => {
    let time;
    if (ctx.match[3] > 70000) {
        ctx.reply('This is too much for me, try with less time (expressed in minutes)');
        return;
    }
    if (!ctx.match[3]) {
        time = 3;
    } else {
        time = ctx.match[3];
    }
    ctx.reply(`Starting ${time} minute tea timer...`);
    setTimeout(() => { ctx.reply(`${ctx.message.from.first_name}, your ${time} minute tea is ready!`); }, time * 60 * 1000);
});

bot.hears(/^\/sayHelloTo (.*)$/, (ctx) => {
    ctx.telegram.sendMessage(ctx.match[1], `Hello from ${ctx.message.from.first_name}!`);
});
bot.hears(/^\/(.)olo$/, ({ match, reply }) => {
    if (invalidSize(match[1])) {
        return;
    }
    const tab = {
        s: 'Sami',
        c: 'Carl',
        j: 'Jeremias',
        p: 'Pascal',
    };
    if (tab[match[1].toLowerCase()] != null) { reply(`${tab[match[1].toLowerCase()]} lebt nur einmal.`); return; }
    reply('You Only Live Online');
});


bot.hears(new RegExp(`getquote(@${process.env.BOT_NAME})? (.*)`, 'i'), ({ match, reply }) => {
    if (match[2] === '') {
        najax({ url: 'https://www.brainyquote.com/quotes_of_the_day.html', type: 'GET' }).success(res => reply(new JSDOM(res).window.document.getElementsByTagName('img')[1].getAttribute('alt')));
    } else {
        najax({ url: `https://www.brainyquote.com/search_results.html?q=${match[2]}`, type: 'GET' }).success((res) => {
            lastQuote = new JSDOM(res).window.document;

            // get results
            lastQuote = lastQuote.getElementById('quotesList');
            if (lastQuote) {
                lastQuote = lastQuote.firstElementChild;
                reply(`${lastQuote.firstElementChild.textContent.replace(/\n\n/g, '')}\n/getnextquote@${process.env.BOT_NAME}`);
            } else {
                reply('Sorry nothing found');
            }
        });
    }
});

bot.command(appendName(['nextquote']), ({ reply }) => {
    if (!lastQuote) {
        reply(`Error. Try /quote@${process.env.BOT_NAME} first!`);
    } else {
        lastQuote = lastQuote.nextElementSibling;
        let temp = lastQuote.firstElementChild.textContent.replace(/\n\n/g, '');
        if (!temp) {
            // if null, this is because evil ads contains no text and should be ignored
            lastQuote = lastQuote.nextElementSibling;
            temp = lastQuote.firstElementChild.textContent.replace(/\n\n/g, '');
        }
        if (!temp) {
            reply('Nothing found try /getquote@sasehashsbot <another search>');
        }
        reply(`${temp}\n/getnextquote@${process.env.BOT_NAME}`);
    }
});

bot.command(appendName(['doctor', 'help', 'cyberDuck']), ({ reply }) => reply(cyberDuck.getInitial()));

bot.hears(new RegExp(`^/r(@${process.env.BOT_NAME})? (.*)`, 'i'), ({ match, reply }) => reply(cyberDuck.transform(match[2])));

// sends the images
const imgurAlbumHelper = (curr, ctx) => {
    // is album?
    if (curr === undefined) {
        ctx.reply('Nothing found!');
        return;
    }
    if (curr.is_album) {
        _.each(curr.images, (e) => {
            if (e.animated) { _.delay(ctx.replyWithVideo, 500, e.mp4); } else { _.delay(ctx.replyWithPhoto, 500, e.link); }
        });
    } else if (curr.animated) { ctx.replyWithVideo(curr.mp4); } else { ctx.replyWithPhoto(curr.link); }
};

// paradise[query] contains 3 fields :
// pos (which image are we on)
// page (actual page number)
// json (api output)
const paradiseHelper = (q, ctx) => {
    let query = q;
    if (query === undefined) {
        query = 'burger';
    }
    query = query.toLowerCase();
    const reply = ctx.reply;
    const sort = 'top';
    if (paradise[query]) {
        const curr = paradise[query];
        if (curr.json.data[curr.pos].link) {
            imgurAlbumHelper(paradise[query].json.data[curr.pos], ctx); // send photos
            paradise[query].pos++;
        } else {
            // download next page
            paradise[query].page++;
            najax({ url: `https://api.imgur.com/3/gallery/search/${sort}/month/${paradise[query].page}?q=${query}`,
                type: 'GET',
                headers: { authorization: `Client-ID ${process.env.APIKEY_IMGUR}` },
            }).success((res) => {
                paradise[query].pos = 1;
                paradise[query].json = res;
                imgurAlbumHelper(paradise[query].json.data[0], ctx); // send photos
            }).error(reply('Nothing found :/'));
        }
    } else {
    // download json from api
        najax({ url: `https://api.imgur.com/3/gallery/search/${sort}/month/0?q=${query}`,
            type: 'GET',
            headers: { authorization: `Client-ID ${process.env.APIKEY_IMGUR}` },
        }).success((res) => {
            paradise[query] = { json: JSON.parse(res), pos: 1, page: 0 }; // add new entry
            imgurAlbumHelper(paradise[query].json.data[0], ctx); // output the images
        });
    }
};

// paradise[query] contains 3 fields :
// pos (which image are we on)
// page (actual page number)
// json (api output)
bot.hears(new RegExp(`/((.+)paradise(@${process.env.BOT_NAME})?)`, 'i'), ctx => paradiseHelper(ctx.match[2], ctx));
bot.command(appendName(['lennysdeath']), ctx => paradiseHelper('burger', ctx));


bot.hears(new RegExp(`correct(@${process.env.BOT_NAME})? ([^ ]+) => (.*)`, 'i'), ({ match, replyWithMarkdown }) => {
    if (invalidSize(match[2]) || invalidSize(match[3])) {
        return;
    }
    userDic[match[2].toLowerCase()] = match[3].replace(/`/g, '\\`');
    replyWithMarkdown(`Change Saved : Try it out !\n\`/check@${process.env.BOT_NAME} ${match[2]}\``);
    fs.readFile('userDic.json', (err, data) => {
        if (err) {
            replyWithMarkdown('Error while opening the file userDic.json');
        } else {
            const o = JSON.parse(data);
            o[match[2]] = match[3].replace(/`/g, '\\`');
            const toWrite = JSON.stringify(o);
            fs.writeFile('userDic.json', toWrite, (e) => {
                if (e) {
                    replyWithMarkdown('Error while writing files!');
                }
            });
        }
    });
});

bot.hears(/sudo(@[^ ]+)+ (.+)/, ({ match, reply }) => {
    if (invalidSize(match[2])) {
        return;
    }
    reply('Access granted.');
    reply(`Executing following command '${match[2]}' with administrator right.`);
    reply(match[1]);
    reply('Processing');
    setTimeout((() => { reply('...'); setTimeout((() => { reply('...'); }), 2000); setTimeout((() => { reply('...'); }), 2000); }), 2000);
    setTimeout(() => {
        reply('Error detected. Trying to recover data.');
        setTimeout(() => reply('Failure. System destroyed', 2000));
    }, 9000);
});


bot.hears(new RegExp(`check(@${process.env.BOT_NAME})? (.+)`, 'i'), ({ match, replyWithMarkdown }) => {
    if (invalidSize(match[2])) {
        return;
    }
    const input = match[2].toLowerCase().replace(/`/g, '\\`').split(' ');
    let hasChange = false;

    const output = _.map(input, (el) => {
        if (userDic[el]) {
            hasChange = true;
            return userDic[el];
        } else if (dictionary[el]) {
            hasChange = true;
            return dictionary[el];
        }
        return el;
    });

    if (hasChange) {
        replyWithMarkdown(`Meinten Sie etwa : ${output.join(' ')}?`);
        return;
    }
    replyWithMarkdown(`Dies erscheint mir richtig. Falls nicht :\n\`/correct@${process.env.BOT_NAME} ${match[2]} => neues Wort\``);
});


bot.on('inline_query', async (ctx) => {
    const offset = parseInt(ctx.inlineQuery.offset, 10) || 0;
    const limit = 50;

    const apiUrl = `https://api.cleanvoice.ru/myinstants/?type=many&limit=${limit}&offset=${offset}&search=${ctx.encodeURIComponent(ctx.inlineQuery.query)}`;
    najax({ url: apiUrl, type: 'GET' })
        .success((res) => {
            const items = JSON.parse(res).items;
            if (items === undefined) { return; }
            const results = items.map(item => ({
                type: 'audio',
                id: item.id.toString(),
                title: item.title.toString(), // there is no name
                audio_url: `https://www.myinstants.com/media/sounds/${item.filename}`,
            }));
            ctx.answerInlineQuery(results);
        });
});

bot.startPolling();
