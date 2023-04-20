print_start "Installing Python"

if ! brew ls --versions python > /dev/null; then
  brew install python
  brew install python@2
  brew install python-tk
fi

print_progress "Installing pip packages"

python3 -m pip install --upgrade pip
pip3 install psutil
pip3 install setuptools
pip3 install six
pip3 install wheel

print_success "Python installed! \n"
