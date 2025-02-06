#!/bin/bash

# print a emoji representing the current clock hour
hour=$(date +"%H")
case $hour in
00 | 12) echo "" ;;
01 | 13) echo "" ;;
02 | 14) echo "" ;;
03 | 15) echo "" ;;
04 | 16) echo "" ;;
05 | 17) echo "" ;;
06 | 18) echo "" ;;
07 | 19) echo "" ;;
08 | 20) echo "" ;;
09 | 21) echo "" ;;
10 | 22) echo "" ;;
11 | 23) echo "" ;;
esac
