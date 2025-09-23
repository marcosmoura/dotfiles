SKETCHYBAR_EXECUTABLE=$(which sketchybar)

# Link sketchybar to sketchybar-top and sketchybar-bottom if not already linked
ln -s $SKETCHYBAR_EXECUTABLE $(dirname $SKETCHYBAR_EXECUTABLE)/sketchybar-top
ln -s $SKETCHYBAR_EXECUTABLE $(dirname $SKETCHYBAR_EXECUTABLE)/sketchybar-bottom

# Build and execute apps
pushd $HOME/.config/sketchybar/apps

cargo build --release

# Kill existing watchers if any
killall media-watcher
killall menubar-watcher
killall weather-watcher

# Start watchers
./bin/release/media-watcher --stream &
./bin/release/menubar-watcher &
./bin/release/weather-watcher &

popd

# Kill existing bars if any
killall sketchybar-top
killall sketchybar-bottom

# Start bars
sketchybar-top &
sketchybar-bottom &
