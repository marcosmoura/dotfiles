print_start "Installing and configuring Python packages"

python -m venv ~/.local/share/venv
source $HOME/.local/share/venv/bin/activate
python -m pip install codespell
python -m pip install psutil
python -m pip install pynvim
python -m pip install setuptools
python -m pip install six
python -m pip install wheel

print_success "Python installed! \n"
