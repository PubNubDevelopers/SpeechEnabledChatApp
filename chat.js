const pollyAudioPubNubFunction = 'https://pubsub.pubnub.com/v1/blocks/sub-key/sub-c-87902f3c-c517-11e9-9cc7-622122667ebb/aws-polly';
const chatChannel = 'my_chat_polly_bsdgyehdb';
const chatHistoryUl = $('#chat-history-ul');

function parseTime(time) {
    return time.toLocaleDateString() + ", " + time.toLocaleTimeString().
    replace(/([\d]+:[\d]{2})(:[\d]{2})(.*)/, "$1$3");
}

// Make a jQuery sort for the chat log based on message timetoken (tt)
jQuery.fn.sortDomElements = (function() {
    return function(comparator) {
        return Array.prototype.sort.call(this, comparator).each(function(i) {
            this.parentNode.appendChild(this);
        });
    };
})();

var generatePerson = function(online) {
    var myChatUser = JSON.parse(localStorage.getItem("myChatUser"));
    if (myChatUser) {
        return myChatUser;
    }

    var person = {};

    var names = 'Suzie Kimi Andrew Austin Michelle Franklyn Burton Ignacio Leta Suzi Brad Malvina Renea Malorie Hellen'.split(' ');

    var avatars = ['https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_01.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_02.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_03.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_04.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_05.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_06.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_07.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_08.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_09.jpg', 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/195612/chat_avatar_10.jpg'];

    person.first = names[Math.floor(Math.random() * names.length)];
    person.last = names[Math.floor(Math.random() * names.length)];
    person.full = [person.first, person.last].join(" ");
    person.uuid = String(new Date().getTime());

    person.avatar = avatars[Math.floor(Math.random() * avatars.length)];

    person.online = online || false;

    person.lastSeen = Math.floor(Math.random() * 60);


    localStorage.setItem('myChatUser', JSON.stringify(person));
    return person;
}

// use a helper function to generate a new profile
let newPerson = generatePerson(true);

let pubnub = new PubNub({
    publishKey: 'pub-c-aaff0a04-c90d-429a-b39d-48f37ac03453',
    subscribeKey: 'sub-c-87902f3c-c517-11e9-9cc7-622122667ebb',
    uuid: newPerson.uuid
});

// compile handlebars templates and store them for use later
let peopleTemplate = Handlebars.compile($("#person-template").html());
let meTemplate = Handlebars.compile($("#message-template").html());
let userTemplate = Handlebars.compile($("#message-response-template").html());

const source_language = "en";
const target_language = "es";

var AUDIO_FORMATS = {
    'ogg_vorbis': 'audio/ogg',
    'mp3': 'audio/mpeg',
    'pcm': 'audio/wave; codecs=1'
};

var supportedFormats;
var player;
var speechEnabled = false;

// this is our main function that starts our chat app
const init = () => {
    //First things first, check for the the browser's audio capabilities
    player = document.getElementById('player');
    supportedFormats = getSupportedAudioFormats(player);

    if (supportedFormats.length === 0) {
        submit.disabled = true;
        alert('The web browser in use does not support any of the' +
            ' available audio formats. Please try with a different' +
            ' one.');
    } else {

        pubnub.addListener({
            message: function(message) {
                renderMessage(message);
            },
            presence: function(presenceEvent) {
                let type = presenceEvent.action;

                if (type === 'join') {
                    let person = generatePerson(true);
                    person.uuid = presenceEvent.uuid;
                    $('#people-list ul').append(peopleTemplate(person));
                } else if (type === 'leave' || type === 'timeout') {
                    $('#people-list ul').find('#' + presenceEvent.uuid).remove();
                }
            }
        });

        pubnub.subscribe({
            channels: [chatChannel],
            withPresence: true
        });

        //get old messages from history
        pubnub.history({
                channel: chatChannel,
                count: 3,
                stringifiedTimeToken: true
            },
            function(status, response) {
                if (response.messages && response.messages.length > 0) {
                    response.messages.forEach((historicalMessage) => {
                        renderMessage(historicalMessage, true);
                    })
                }
            }
        );

        $("#speechButton").click(function() {

            if (speechEnabled) {
                speechEnabled = false;
                $("#speechButton").css("background-color", "#d4e2dd");

            } else {
                speechEnabled = true;
                $("#speechButton").css("background-color", "#4ceab1");
            }

        })

        $('#sendMessage').on('submit', sendMessage)
    }
};

// send a message to the Chat
const sendMessage = () => {

    // get the message text from the text input
    let message = $('#message-to-send').val().trim();

    // if the message isn't empty
    if (message.length) {
        // emit the `message` event to everyone in the Chat
        pubnub.publish({
            message: {
                text: message,
                translate: {
                    text: message,
                    source: source_language,
                    target: target_language
                },
                polly: {
                    text: message
                }
            },
            channel: chatChannel
        });

        // clear out the text input
        $('#message-to-send').val('');
    }

    // stop form submit from bubbling
    return false;

};

// render messages in the list
const renderMessage = (message) => {

    // use the generic user template by default
    let template = userTemplate;

    // if I happened to send the message, use the special template for myself
    if (message.publisher === pubnub.getUUID()) {
        template = meTemplate;
    }

    let isHistory = false
    if (message && !message.message) {
        console.log(message)
        message = { message: message.entry, timetoken: message.timetoken }
        isHistory = true;
    }

    var messageJsTime = new Date(parseInt(message.timetoken.substring(0, 13)));

    let el = template({
        messageOutput: message.message.text,
        tt: messageJsTime.getTime(),
        time: parseTime(messageJsTime),
        user: message.publisher
    });

    console.log(message);

    if (speechEnabled && message.publisher != pubnub.getUUID()) {

        getPollyAudioForText(message.message.text).then((audio) => {
            player.src = audio
            player.play();
        })
    }

    chatHistoryUl.append(el);

    // chatHistoryUl.append(template(context));

    // Sort messages in chat log based on their timetoken (tt)
    chatHistoryUl
        .children()
        .sortDomElements(function(a, b) {
            akey = a.dataset.order;
            bkey = b.dataset.order;
            if (akey == bkey) return 0;
            if (akey < bkey) return -1;
            if (akey > bkey) return 1;
        })

    // scroll to the bottom of the chat
    scrollToBottom();

};

// scroll to the bottom of the window
const scrollToBottom = () => {
    $('.chat-history').scrollTop($('.chat-history')[0].scrollHeight);
};

/**
 * Returns a list of audio formats supported by the browser
 */
function getSupportedAudioFormats(player) {
    return Object.keys(AUDIO_FORMATS)
        .filter(function(format) {
            var supported = player.canPlayType(AUDIO_FORMATS[format]);
            return supported === 'probably' || supported === 'maybe';
        });
}

function getPollyAudioForText(text) {
    return new Promise((resolve) => {
        $.ajax({
            method: "POST",
            url: pollyAudioPubNubFunction,
            data: JSON.stringify({
                "data": {
                    "text": text,
                    "polly": {
                        "voice": "Matthew",
                        "format": "mp3",
                        "location": "text"
                    }
                }
            }),
        }).done(function(res) {
            return resolve('data:audio/mp3;base64,' + res.polly_sound);
        });
    });
}

window.onbeforeunload = function() {
    pubnub.unsubscribe([chatChannel])
};

// boot the app
init();