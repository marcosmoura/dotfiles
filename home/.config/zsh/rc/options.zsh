# Shell options. History has its own file.
#
# Options have to be set here, before the first prompt. Deferred code runs
# inside a function that restores the options when it returns, so a `setopt`
# in ../deferred or in a deferred plugin does not last.

# Directories: a directory name on its own means cd, and every cd pushes onto
# the stack (`cd -<tab>`, and ctrl-shift-left/right from the dircycle plugin)
setopt auto_cd auto_pushd pushd_ignore_dups pushd_minus

# Completion: complete from the cursor's position inside a word, and move the
# cursor to the end of the word once it is complete
setopt complete_in_word always_to_end

# Let ctrl-s and ctrl-q reach the shell instead of pausing the terminal
unsetopt flow_control

# Allow `# comments` on the command line. atuin expects this.
setopt interactive_comments
