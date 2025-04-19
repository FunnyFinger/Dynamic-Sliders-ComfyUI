# ComfyUI Custom Node Development Rules

This document outlines the development standards and best practices for creating custom nodes for ComfyUI with AI assistance.

## Project Structure

```
custom_nodes/your_node_name/
├── __init__.py                 # Node registration
├── node_implementation.py      # Main Python implementation
├── js/
│   ├── main.js                 # Frontend implementation
│   └── widget_implementations.js
├── .vscode/
│   └── settings.json           # VSCode settings
├── .eslintrc.json              # JavaScript linting rules
├── .prettierrc                 # Code formatting rules
├── .editorconfig               # Editor configuration
├── setup.cfg                   # Python linting configuration
├── .gitignore                  # Git exclusion patterns
└── README.md                   # Documentation
```

## Development Guidelines

### Python (Backend)

1. **Node Structure**:
   - Define nodes as classes with clear `INPUT_TYPES`, `RETURN_TYPES`, and `FUNCTION` methods
   - Keep node implementations focused on a single responsibility
   - Use descriptive variable names and add docstrings

2. **Type Annotation**:
   - Use type hints to improve code readability and AI assistance quality
   - Annotate function parameters and return values

3. **Error Handling**:
   - Implement proper error handling with meaningful error messages
   - Validate user inputs before processing

### JavaScript (Frontend)

1. **Widget Integration**:
   - Follow ComfyUI's widget patterns for consistency
   - Implement proper event handling and update mechanisms

2. **Naming Conventions**:
   - Use camelCase for variables and functions
   - Use PascalCase for class names
   - Prefix private functions with underscore (_)

3. **DOM Manipulation**:
   - Use ComfyUI's built-in methods when possible
   - Avoid direct DOM manipulation where possible

## AI-Assisted Development Tips

1. **Clear Prompting**:
   - Provide context about ComfyUI architecture in your prompts
   - Reference existing implementations for similar functionality
   - Specify dependencies and environment constraints

2. **Code Review**:
   - Always review AI-generated code before implementation
   - Test edge cases that AI might have missed
   - Verify all imports and dependencies are properly handled

3. **Iterative Development**:
   - Break complex features into smaller, manageable tasks for AI
   - Implement core functionality first, then add refinements
   - Maintain a clear record of implementation steps

## Testing Custom Nodes

1. **Manual Testing**:
   - Test nodes in various workflows and with different inputs
   - Verify error handling works as expected
   - Test compatibility with different ComfyUI versions

2. **Documentation**:
   - Create clear usage examples
   - Document any special requirements or limitations
   - Include screenshots or GIFs demonstrating functionality

## Publishing Guidelines

1. **Pre-release Checklist**:
   - Remove debug console logs
   - Ensure proper error handling
   - Verify compatibility with latest ComfyUI version
   - Check for hardcoded paths or values

2. **Documentation**:
   - Provide clear installation instructions
   - Include usage examples and screenshots
   - List dependencies and requirements
   - Explain widget behavior and functionality

3. **Distribution**:
   - Include license information
   - Create a proper README with installation and usage instructions
   - Consider providing sample workflows demonstrating your nodes

## Linting and Formatting Tools

This project uses the following tools for code quality:

- **ESLint**: JavaScript code quality
- **Prettier**: Code formatting
- **Flake8/autopep8**: Python code quality and formatting
- **EditorConfig**: Consistent editor settings

Configure your editor to use these tools for the best development experience.

## Version Control Best Practices

1. **Commit Messages**:
   - Use clear, descriptive commit messages
   - Reference issues or feature requests when applicable

2. **Branching**:
   - Use feature branches for new functionality
   - Create hotfix branches for critical fixes

3. **Pull Requests**:
   - Include screenshots or videos demonstrating functionality
   - List any breaking changes
   - Tag relevant reviewers
