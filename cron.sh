#!/bin/bash
source ~/.nvm/nvm.sh
$(nvm which node) $@ >> ./cron.log 2>&1
