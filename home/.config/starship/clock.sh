#!/bin/bash

# print a emoji representing the current clock hour
echo -n "" | cut -c $(($(date +%I) + 1))
