## APRS to Discord bridge

# About

Originally created by Ryzerth for the SignalsEverywhere discord server (https://signalseverywhere.com/discord)

# How to install

- Make sure the Oxyde bot framework is installed (https://github.com/AlexandreRouma/Oxyde)
- Navigate to the `modules` directory of the framework
- Run `git clone https://github.com/AlexandreRouma/aprs_bridge`
- Run the bot framework, wait for it to initialized, then shut it down
- Change the config in `config/config.json`. You need to specify a callsign, a passcode, the id of the channel in which you want the bot to post messages in, the ID of your discord server, and finally the ID of the role that is allowed to send APRS messages (leave blank if you don't want anyone to send messages).
- Done! Start up the bot as usual and it should start posting messages sent to the callsign to the channel you specified.