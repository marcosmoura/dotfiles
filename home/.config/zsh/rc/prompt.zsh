# Prompt: starship, plus the two values its config reads from the environment
# (see the custom modules in ~/.config/starship/starship.toml).

# STARSHIP_EMOJI: a glyph for the directory this shell starts in, or else one
# for today's date.
() {
  local glyph
  case $PWD in
    *fluent*) glyph='󰍲' ;;
    *dotfiles*) glyph='󱃖' ;;
    *)
      # The pick for a date is random. It is kept for an hour, so that every
      # tab opened in that hour shows the same one.
      local kept=$ZSH_CACHE/starship-emoji
      local -a fresh=($kept(N.mh-1))
      if (($#fresh)); then
        glyph=$(<$kept)
      else
        local -a pick today=(${(s: :)${(%):-%D{%m %d %u}}})
        local -i month=10#$today[1] day=10#$today[2] weekday=$today[3]

        if ((month == 1 && day == 1)); then
          pick=(🥳 🎆 🎇 🍾 🎉)
        elif ((month == 2 && day == 14)); then
          pick=(❤️ 💘 💝 🌹 🥰)
        elif ((month == 10 && day == 15)); then
          pick=(🎂 🎉 🥳 🎁)
        elif ((month == 10 && day == 31)); then
          pick=(👹 👺 👻 💀 🎃 🧛🏻‍♂️ 🧟‍♂️ 🕷 🕸)
        elif ((day == 13 && weekday == 5)); then
          pick=(👻 💀)
        elif ((month == 12 && day == 25)); then
          pick=(🎅🏻 🎄 🎁 ☃️ ⛄️)
        elif ((month == 12 && day == 31)); then
          pick=(🍾 🥂 🎊 🎉)
        elif ((weekday >= 6)); then
          pick=(😎 🛌 🏖 📚)
        else
          pick=(󰉋)
        fi

        glyph=${pick[RANDOM % $#pick + 1]}
        print -rn -- $glyph >|$kept
      fi
      ;;
  esac

  export STARSHIP_EMOJI="$glyph  "
}

# STARSHIP_CLOCK: a clock face showing the hour this shell started in
() {
  local -a faces=(󱑊 󱐿 󱑀 󱑁 󱑂 󱑃 󱑄 󱑅 󱑆 󱑇 󱑈 󱑉)
  local -i hour=10#${(%):-%D{%H}}
  export STARSHIP_CLOCK=${faces[hour % 12 + 1]}
}

# starship's init code fills PROMPT2, the prompt for an unfinished command, by
# running `starship prompt --continuation` on every start, which takes 8 ms.
# In single quotes, zsh runs it when such a prompt is shown instead.
_starship-init() {
  starship init zsh --print-full-init | sed -E "s/^PROMPT2=\"(.*)\"$/PROMPT2='\\1'/"
}

cached starship _starship-init && source $REPLY
unfunction _starship-init
