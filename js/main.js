const log = console.log
const input = $('#input')

const fileSystem = loadFileSystem()

let commandHistory = loadCommandHistory()
let commandHistoryPointer = 0

let maximized = false
let cursorIndex = 0

// Helper functions
const pathToFolderArray = (path) => path.split('/').filter(e => e !== '')
const folderArrayToPath = (array) => '/' + array.join('/')
const fsExists = (path) => !!fileSystem[path]
const isFolder = (path) => fsExists(path) && fileSystem[path].type === 'folder'
const isFile = (path) => fsExists(path) && fileSystem[path].type === 'file' 
const isAbsolutePath = (path) => path[0] === '/'
const isValidAbsolutePath = (path) => !!path.match(/^(\/[a-zA-Z0-9._-]*)+$/g)

function relativeToAbsolute(relativePath) {
  if (isAbsolutePath(relativePath)) return relativePath
  const folders = pathToFolderArray(fileSystem.wd)
  for (const folder of pathToFolderArray(relativePath)) {
    if (folder === '..') folders.splice(folders.length-1, 1)
    else if (folder !== '.') folders.push(folder)
  }
  return folderArrayToPath(folders)
}

function makeFolder(path) {
  if (!fsExists(path)) {
    fileSystem[path] = {type: 'folder'}
  }
}

function makeFolderAndSubfolders(path) {
  const folders = pathToFolderArray(path)
  for (let i = 0; i < folders.length; i++) {
    makeFolder(folderArrayToPath(folders.slice(0, i+1)))
  }
}

function trimFolder(path) {
  const folders = pathToFolderArray(path)
  folders.pop()
  return folderArrayToPath(folders)
}

// Commands
function parseCommand(str) {
  const tokens = str.split(/ +/)
  const command = tokens.splice(0, 1)[0]
  const flags = []
  const args = []
  tokens.forEach(token => {
    if (token.startsWith('-')) {
      const flagToken = token.replace('-', '')
      for (const flag of flagToken) {
        if (flags.indexOf(flag) === -1) flags.push(flag)
      }
    } else args.push(token)
  })
  return { command, flags, args }
}

function executeCommand(value) {
  if (!value) return
  saveCommandHistory(value)
  const { command, flags, args } = parseCommand(value)
  const commandFunction = {
    'pwd': () => print(fileSystem.wd),
    'ls': ls,
    'cd': cd,
    'cd..': () => cd(['..']),
    'mkdir': mkdir,
    'echo': echo,
    'cat': cat,
    'rm': rm,
    'mv': mv,
    'clear': () => $('.term_term').empty(),
    'breaking': breaking,
    'help': help,
    'man': man,
    'js': js,
    'history': history,
    'cowsay': cowsay
  }[command]
  commandFunction ? commandFunction(args, flags) : unrecognizedCommand(command)
  if (command !== 'clear') print(' ')
}

function ls() {
  const depth = pathToFolderArray(fileSystem.wd).length + 1
  Object.keys(fileSystem).forEach(path => {
    if (path.startsWith(fileSystem.wd)) {
      const folders = pathToFolderArray(path)
      if (folders.length === depth) {
        print(folders[folders.length-1])
      }
    }
  })
}

function cd(args) {
  const path = relativeToAbsolute(args[0])
  isFolder(path) ?
    fileSystem.wd = path :
    print('The system cannot find the path specified.', error=true)
}

function mkdir(args) {
  if (args.length === 0) return
  const path = relativeToAbsolute(args[0])
  
  if (!isValidAbsolutePath(path)) {
    print('The filename, directory name, or volume label syntax is incorrect.', error=true)
    return
  }

  if (fileSystem[path]) {
    print('A subdirectory or file ' + args[0] + ' already exists.', error=true)
    return
  }
  
  makeFolderAndSubfolders(path)
  saveFileSystem()

  mkdir(args.slice(1))
}

function echo(args) {
  if (args.length === 0) return

  args = args.join(' ').split(/ *> */)
  const text = args[0]

  if (args.length === 1) {
    print(text)
    return
  }
  
  const path = relativeToAbsolute(args[1])

  const folderPath = trimFolder(path)
  if (!fsExists(folderPath)) makeFolderAndSubfolders(folderPath)

  isFile(path) ?
    fileSystem[path].content += text :
    fileSystem[path] = { type: 'file', content: text }

  saveFileSystem()
}

function cat(args) {
  const path = relativeToAbsolute(args[0])
  isFile(path) ?
    print(fileSystem[path].content) :
    print('The system cannot find the file specified.', error=true)
}

function rm(args, flags) {
  if (args.length === 0) return
  const path = relativeToAbsolute(args[0])
  
  if (!isValidAbsolutePath(path)) {
    print('The filename, directory name, or volume label syntax is incorrect.', error=true)
    return
  }

  if (isFile(path)) {
    delete fileSystem[path]
    saveFileSystem()
    return
  }

  if (flags.indexOf('R') === -1) {
    print('\'' + path + '\' is a directory. Use rm -R instead.', error=true)
  }

  Object.keys(fileSystem).forEach(pathItem => {
    if (pathItem.startsWith(path)) {
      delete fileSystem[pathItem]
    }
  })

  saveFileSystem()
  rm(args.slice(1), flags)
}

function mv(args) {
  const sourcePath = relativeToAbsolute(args[0])
  const destPath = relativeToAbsolute(args[1])

  if (!isValidAbsolutePath(sourcePath)) {
    print('The system cannot find the soruce path specified.', error=true)
    return
  }

  if (!isValidAbsolutePath(destPath)) {
    print('The system cannot find the destination path specified.', error=true)
    return
  }

  if (fsExists(destPath)) {
    print('There is already a folder or file in the destination path.', error=true)
    return
  }

  if (isFile(sourcePath)) {
    const file = fileSystem[sourcePath]
    delete fileSystem[sourcePath]
    const folderPath = trimFolder(destPath)
    if (!fsExists(folderPath)) makeFolderAndSubfolders(folderPath)
    fileSystem[destPath] = file
    saveFileSystem()
    return
  }

  print('Functionality not implemented', error=true)
}

function breaking() {
  const element = $('.term_term p').last()
  $.get('https://breakingbadapi.com/api/quote/random?series=Breaking+Bad').then(response => {
    printAfter(element, '— ' + response[0].author)
    printAfter(element, response[0].quote)
  })
}

function help() {
  print('Built-in commands:')
  print('"pwd" - Print working directory')
  print('"ls" - List directory content')
  print('"cd" - Change the working directory, or move up one directory level using "cd .."')
  print('"mkdir" - Make directories')
  print('"echo" - Create files with the possibility of adding a text inside each of them')
  print('"cat" - Show the content of given file')
  print('"rm" - Remove directory entries')
  print('"mv" - Move files')
  print('"touch" - Change file access and modification times')
  print('"clear" - Clear the terminal screen')
  print('"man" - Format and display the online manual pages')
  print('"breaking" - Get a random quote from the TV show Breaking Bad')
  print('"history" - Show the command history')
  print('"cowsay" - Show a funny cow saying something provided by the user')
}

function js(args) {
  if (args.length === 0) {
    print('Please specify a file name to execute JavaScript code from.', error=true)
    return
  }

  const path = relativeToAbsolute(args[0])

  if (!isFile(path)) {
    print('The system cannot find the file specified.', error=true)
    return
  }

  try {
    const result = eval(fileSystem[path].content)
    if (result) print('Result: ' + result)
  } catch(err) {
    print(err, error=true)
  }
}

function history(_, flags) {
  if (flags.indexOf('c') !== -1) {
    commandHistory = []
    commandHistoryPointer = 0
    saveCommandHistory('')
    print('Command history cleared succefuly.')
  } else {
    for (let i = commandHistory.length; i >= 0; i--) {
      print(commandHistory[i])
    }
  }
}

function cowsay(args) {
  if (args.length === 0) return
  const text = args.join(' ')
  // split text in lines of max 39 characters
  const lines = text.match(/.{1,39}/g)
  const size = lines[0].length + 2
  print(' ' + '_'.repeat(size))
  if (lines.length > 1) {
    print('/ ' + lines[0] + ' \\')
    for (let i = 1; i < lines.length - 1; i++) {
      print('| ' + lines[i] + ' |')
    }
    print('\\ ' + lines[lines.length - 1].padEnd(39) + ' /')
  } else {
    print('< ' + lines[0] + ' >')
  }
  print(' ' + '-'.repeat(size))
  print('        \\   ^__^')
  print('         \\  (oo)\\_______')
  print('            (__)\\       )\\/\\')
  print('                ||----w |')
  print('                ||     ||')
}

// Terminal
function scrollToBottom() {
  const window = document.querySelector('.term_term')
  window.scrollTo(0, window.scrollHeight) 
}

function writeInput() {
  const text = input.val() + ' '
  const index = text.length - cursorIndex - 1
  $('.clone').html(
    text.slice(0, index) + '<span class="term_cursor">' + text[index] + '</span>' + text.slice(index+1)
  )
}

function inputInput() {
  writeInput()
  scrollToBottom()
}

function inputIntro() {
  const value = input.val().trim()
  $('.clone').removeClass('clone')
  $('.term_cursor').removeClass('term_cursor')
  executeCommand(value)
  printPromt()
}

function print(text, error=false) {
  $('.term_term').append(
    $('<p>').append($('<span>', {
      class: error ? 'error' : '',
      text: text
    }))
  )
  scrollToBottom()
}

function printAfter(element, text) {
  element.after(
    $('<p>').append($('<span>').text(text))
  )
  scrollToBottom()
}

function printPromt() {
  input.val('')
  cursorIndex = 0
  let wd = fileSystem.wd
  if (wd.startsWith('/home/user')) {
    wd = wd.replace('/home/user', '~')
  }
  $('.term_term').append(
    $('<p>').append(
      $('<span>', { class: 'prompt', text: 'AT ' + wd + '> ' }),
      $('<span>', { class: 'clone' }).append($('<span>', { class: 'term_cursor', text: ' ' }))
    )
  )
  scrollToBottom()
}

function unrecognizedCommand(command) {
  print('The term \'' + command + '\' is not recognized as an internal or external command,',  error=true)
  print('operable program or batch file.', error=true)
}

function loadFileSystem() {
  const data = localStorage.getItem('fileSystem')
  return data ? JSON.parse(data) : {
    'wd': '/',
    '/': {type: 'folder'},
    '/bin': {type: 'folder'},
    '/tmp': {type: 'folder'},
    '/media': {type: 'folder'},
    '/home': {type: 'folder'},
    '/home/user': {type: 'folder'},
    '/home/user/src': {type: 'folder'},
    '/home/user/src/js': {type: 'folder'},
    '/home/user/src/js/app.js': {type: 'file', content: 'print(["Hello", "World!"].join(" "))'},
    '/home/user/src/js/tests': {type: 'folder'},
    '/home/user/src/js/tests/main.js': {type: 'file', content: '3 * 4 + 10'},
    '/home/user/src/html': {type: 'folder'},
    '/home/user/src/html/index.html': {type: 'file', content: '<p>Hello World</p>'}
  }
}

function saveFileSystem() {
  localStorage.setItem('commandHistory', JSON.stringify(fileSystem))
}

function loadCommandHistory() {
  const data = localStorage.getItem('commandHistory')
  return data ? JSON.parse(data) : ['']
}

function saveCommandHistory(command) {
  const index = commandHistory.indexOf(command)
  if (index !== -1) commandHistory.splice(index, 1)
  commandHistory.splice(1, 0, command)
  localStorage.setItem('commandHistory', JSON.stringify(commandHistory))
}

function arrowUp() {
  if (commandHistoryPointer < commandHistory.length - 1) {
    commandHistoryPointer++
    putCommandFromHistory()
  }
}

function arrowDown() {
  if (commandHistoryPointer > 0) {
    commandHistoryPointer--
    putCommandFromHistory()
  }
}

function arrowLeft() {
  if (cursorIndex < input.val().length) cursorIndex++
  writeInput()
}

function arrowRight() {
  if (cursorIndex > 0) cursorIndex--
  writeInput()
}

function putCommandFromHistory() {
  const command = commandHistory[commandHistoryPointer]
  input.val(command)
  cursorIndex = 0
  writeInput()
}

// Event Listeners
printPromt()
input.focus()
$(document).on('click', function() { input.focus() })
input.on('input', inputInput)
input.on('keypress', function(e) {
  if (e.key === 'Enter') inputIntro()
})

input.on('keydown', function(e) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()

  if (e.key === 'ArrowUp') arrowUp()
  else if (e.key === 'ArrowDown') arrowDown()
  else if (e.key === 'ArrowLeft') arrowLeft()
  else if (e.key === 'ArrowRight' || e.key === 'Delete') arrowRight()
})

$('#maximize').on('click', () => {
  if (maximized) {
    $('.term').css({
      top: 'calc(50% - 262px)',
      left: 'calc(50% - 462px)',
      width: '924px',
      height: '524px'
    })
    $('#maximize use').attr('xlink:href', '/svg/icons.svg#maximize-window')
  } else {
    $('.term').css({
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh'
    })
    $('#maximize use').attr('xlink:href', '/svg/icons.svg#restore-window')
  }
  maximized = !maximized
})

// Misc
setInterval(() => {
  $('.term_cursor').toggleClass('term_cursor--hidden')
}, 1200)

$('.term').draggable({
  containment : 'window',
  cancel: '.term_body'
})

// Man
function man() {
  print('Implemented in the other porject.', error=true)
}