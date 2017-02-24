"use strict";

const
  bodyParser = require('body-parser'),
  config = require('config'),
  express = require('express'),
  morgan = require('morgan'),
  Bot = require('messenger-bot');


class App {

  loadSetting() {
    // Retrieve setting from either environment variables or from config
    //
    this.APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
      process.env.MESSENGER_APP_SECRET :
      config.get('appSecret');

    this.VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
      (process.env.MESSENGER_VALIDATION_TOKEN) :
      config.get('validationToken');

    this.PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
      (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
      config.get('pageAccessToken');

    this.SERVER_URL = (process.env.SERVER_URL) ?
      (process.env.SERVER_URL) :
      config.get('serverURL');
  }

  createBot() {
    let bot = new Bot({
      token: this.PAGE_ACCESS_TOKEN,
      verify: this.VALIDATION_TOKEN,
      app_secret: this.APP_SECRET
    });

    bot.on('error', (err) => { this.handleBotErr(err) });
    bot.on('message', (payload, reply) => { this.handleBotMessage(payload, reply); });

    return bot;
  }

  handleBotErr(err) {
    console.log(err);
  }

  handleBotMessage(payload, reply) {
    let text = payload.message.text;
    this.bot.getProfile(payload.sender.id, (err, profile) => {
      if (err) throw err

      reply({ text }, (err) => {
        if (err) throw err

        console.log(`Echoed back to ${profile.first_name} ${profile.last_name}: ${text}`)
      })
    });
  }

  getAPIRouter() {
    let router = express.Router();

    // TODO: add router
    // router.get('/some', (req, res)=> { this.apiAppSome(req, res)});
    //
    return router;
  }

  getBotRouter(bot) {
    let router = express.Router();

    router.get('/', (req, res)=> {
      return bot._verify(req, res);
    })

    router.post('/', (req, res) => {
      bot._handleMessage(req.body)
      res.end(JSON.stringify({status: 'ok'}))
    })

    return router;
  }

  start(port) {
    this.loadSetting();
    if (!this.APP_SECRET || !this.VALIDATION_TOKEN || !this.PAGE_ACCESS_TOKEN || !this.SERVER_URL)
      throw "Missing config values";

    this.bot = this.createBot();

    let app = express();
    app.set('view engine', 'ejs');
    app.use(express.static('public'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(morgan('common'));
    app.use('/api', this.getAPIRouter());
    app.use('/webhook', this.getBotRouter(this.bot));

    // default error handler
    //
    app.use((err, req, res, next) => {
        logger.error('Error request[' + req.url + '] Err=[' + err.toString() + ']');
        res.status(500).send('Error occurred:' + err.toString());
    });

    app.listen(port);
  }


}

let app = new App();
let port = process.env.PORT || 5000;
try {
  app.start(port);
  console.log('Bot started at port:' + port);
}
catch(exception) {
  console.log('Exception:' + exception);
  process.exit(1);
}






