function getShellOutput(output: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Task.run('/bin/sh', ['-c', `echo ${output}`], ({ status, output }) => {
      if (status === 0) {
        return resolve(output.trim())
      }

      reject(`Could not execute command to fetch '${output}'`)
    })
  })
}

function getShellVariable(variable: string): Promise<string> {
  return getShellOutput(`"${variable}"`)
}

function getExecutablePath(command: string): Promise<string> {
  return getShellOutput(`$(which ${command})`)
}

export { getExecutablePath, getShellVariable }
