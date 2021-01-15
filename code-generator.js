/*
* Copyright (c) 2014-2018 MKLab. All rights reserved.
* Copyright (c) 2014 Sebastian Schleemilch.
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*
*/

const _CPP_CODE_GEN_H = 'h'
const _CPP_CODE_GEN_CPP = 'cpp'

const path = require('path')
const fs = require('fs')
const codegen = require('./codegen-utils')


var copyrightHeader = '/* Test header @ toori67 \n * This is Test\n * also test\n * also test again\n */'
var versionString = 'v0.0.1'

/**
* Cpp Code Generator
*/
class CppCodeGenerator {
  /**
   * @constructor
   *
   * @param {type.UMLPackage} baseModel
   * @param {string} basePath generated files and directories to be placed
   *
   */
  constructor (baseModel, basePath) {
    /** @member {type.Model} */
    this.baseModel = baseModel

    /** @member {string} */
    this.basePath = basePath

    /** @member {string} */
    this.tabString = '    '

    var doc = ''

    if (app.project.getProject().name && app.project.getProject().name.length > 0) {
      doc += '\nProject ' + app.project.getProject().name
    }
    if (app.project.getProject().author && app.project.getProject().author.length > 0) {
      doc += '\n@author ' + app.project.getProject().author
    }
    
    if (app.project.getProject().version && app.project.getProject().version.length > 0) {
      doc += '\n@version ' + app.project.getProject().version
    }

    copyrightHeader = this.getDocuments(doc)
  }

  genDocHeader (elem, filename) {
    var doc = ''

    var nowstr = new Date(Date.now() - new Date().getTimezoneOffset()*60*1000).toISOString().substr(0, 10)
    doc += '\nProject ' + app.project.getProject().name
    doc += '\n@file ' + filename
    doc += '\n@author ' + app.project.getProject().author
    doc += '\n@brief \n' + elem.documentation.trim()+'\n'
    doc += '\n@version ' + app.project.getProject().version
    doc += '\n@date ' + nowstr;
    doc += '\n\n@copyright ' + app.project.getProject().copyright
    
    return this.getDocuments(doc)
  }

  /**
  * Return Indent String based on options
  * @param {Object} options
  * @return {string}
  */
  getIndentString (options) {
    if (options.useTab) {
      return '\t'
    } else {
      var i, len
      var indent = []
      for (i = 0, len = options.indentSpaces; i < len; i++) {
        indent.push(' ')
      }
      return indent.join('')
    }
  }

  generate (elem, basePath, options) {
    this.genOptions = options

    var getFilePath = (extenstions) => {
      var absPath = basePath + '/' + elem.name + '.'
      if (extenstions === _CPP_CODE_GEN_H) {
        absPath += _CPP_CODE_GEN_H
      } else {
        absPath += _CPP_CODE_GEN_CPP
      }
      return absPath
    }

    var writeClassDiagram = (codeWriter, elem, cppCodeGen) => {
      var i

      var classViews = elem.ownedViews.filter(function (v) {
        return v instanceof type.UMLClassView 
          || v instanceof type.UMLInterfaceView 
          || v instanceof type.UMLEnumerationView
      })

      if (classViews.length > 0){
        for (i = 0 ; i < classViews.length; i++){
          codeWriter.writeLine('#include "' + classViews[i].model.name + '.' + _CPP_CODE_GEN_H + '"\n');
        }
      }
    }

    var writeEnumeration = (codeWriter, elem, cppCodeGen) => {
      var i
      var modifierList = cppCodeGen.getModifiers(elem)
      var modifierStr = ''
      for (i = 0; i < modifierList.length; i++) {
        modifierStr += modifierList[i] + ' '
      }
      codeWriter.writeLine(modifierStr + 'enum ' + elem.name + ' { ' + elem.literals.map(lit => lit.name).join(', ') + ' };')
    }

    var writeClassHeader = (codeWriter, elem, cppCodeGen) => {

      // add stl
      codeWriter.writeLine('// stl')
      codeWriter.writeLine('#include <memory>')
      codeWriter.writeLine('#include <vector>')
      codeWriter.writeLine('#include <string>')
      codeWriter.writeLine()

      // add thrid part lib
      codeWriter.writeLine('// thrid part lib')
      codeWriter.writeLine()

      // doc
      codeWriter.writeLine(cppCodeGen.getDocuments(
        '@class ' + elem.name
        + '\n@brief \n' + elem.documentation.trim()
      ));

      var i
      var write = (items) => {
        var i
        for (i = 0; i < items.length; i++) {
          var item = items[i]
          if (item instanceof type.UMLAttribute || item instanceof type.UMLAssociationEnd) { // if write member variable
            codeWriter.writeLine(cppCodeGen.getMemberVariable(item))
          } else if (item instanceof type.UMLOperation) { // if write method
            codeWriter.writeLine(cppCodeGen.getMethod(item, false))
          } else if (item instanceof type.UMLClass) {
            writeClassHeader(codeWriter, item, cppCodeGen)
          } else if (item instanceof type.UMLEnumeration) {
            writeEnumeration(codeWriter, item, cppCodeGen)
          }
        }
      }

      var writeInheritance = (elem) => {
        var inheritString = ': '
        var genList = cppCodeGen.getSuperClasses(elem)
        if (genList.length === 0) {
          return ''
        }
        var i
        var term = []
        for (i = 0; i < genList.length; i++) {
          var generalization = genList[i]
          // public AAA, private BBB
          term.push(generalization.visibility + ' ' + generalization.target.name)
        }
        inheritString += term.join(', ')
        return inheritString
      }

      // member variable
      var memberAttr = elem.attributes.slice(0)
      var associations = app.repository.getRelationshipsOf(elem, function (rel) {
        return (rel instanceof type.UMLAssociation)
      })
      for (i = 0; i < associations.length; i++) {
        var asso = associations[i]
        if (asso.end1.reference === elem && asso.end2.navigable === true && asso.end2.name.length !== 0) {
          memberAttr.push(asso.end2)
        } else if (asso.end2.reference === elem && asso.end1.navigable === true && asso.end1.name.length !== 0) {
          memberAttr.push(asso.end1)
        }
      }

      // method
      var methodList = elem.operations.slice(0)
      var innerElement = []
      for (i = 0; i < elem.ownedElements.length; i++) {
        var element = elem.ownedElements[i]
        if (element instanceof type.UMLClass || element instanceof type.UMLEnumeration) {
          innerElement.push(element)
        }
      }

      var allMembers = memberAttr.concat(methodList).concat(innerElement)
      var classfiedAttributes = cppCodeGen.classifyVisibility(allMembers)
      var finalModifier = ''
      if (elem.isFinalSpecialization === true || elem.isLeaf === true) {
        finalModifier = ' final '
      }
      var templatePart = cppCodeGen.getTemplateParameter(elem)
      if (templatePart.length > 0) {
        codeWriter.writeLine(templatePart)
      }

      codeWriter.writeLine('class ' + elem.name + finalModifier + writeInheritance(elem) + ' {')
      if (classfiedAttributes._public.length > 0) {
        codeWriter.writeLine('public: ')
        codeWriter.indent()
        write(classfiedAttributes._public)
        codeWriter.outdent()
      }
      if (classfiedAttributes._protected.length > 0) {
        codeWriter.writeLine('protected: ')
        codeWriter.indent()
        write(classfiedAttributes._protected)
        codeWriter.outdent()
      }
      if (classfiedAttributes._private.length > 0) {
        codeWriter.writeLine('private: ')
        codeWriter.indent()
        write(classfiedAttributes._private)
        codeWriter.outdent()
      }

      codeWriter.writeLine('};')
    }

    var writeClassBody = (codeWriter, elem, cppCodeGen) => {
      var i = 0
      var item
      var writeClassMethod = (elemList) => {
        for (i = 0; i < elemList._public.length; i++) {
          item = elemList._public[i]
          if (item instanceof type.UMLOperation) { // if write method
            codeWriter.writeLine(cppCodeGen.getMethod(item, true))
          } else if (item instanceof type.UMLClass) {
            writeClassBody(codeWriter, item, cppCodeGen)
          }
        }

        for (i = 0; i < elemList._protected.length; i++) {
          item = elemList._protected[i]
          if (item instanceof type.UMLOperation) { // if write method
            codeWriter.writeLine(cppCodeGen.getMethod(item, true))
          } else if (item instanceof type.UMLClass) {
            writeClassBody(codeWriter, item, cppCodeGen)
          }
        }

        for (i = 0; i < elemList._private.length; i++) {
          item = elemList._private[i]
          if (item instanceof type.UMLOperation) { // if write method
            codeWriter.writeLine(cppCodeGen.getMethod(item, true))
          } else if (item instanceof type.UMLClass) {
            writeClassBody(codeWriter, item, cppCodeGen)
          }
        }
      }

      // parsing class
      var methodList = cppCodeGen.classifyVisibility(elem.operations.slice(0))
      var docs = elem.name + ' implementation\n\n'
      // if (typeof elem.documentation === 'string') {
      //   docs += elem.documentation
      // }
      codeWriter.writeLine(cppCodeGen.getDocuments(docs))
      writeClassMethod(methodList)

      // parsing nested class
      var innerClass = []
      for (i = 0; i < elem.ownedElements.length; i++) {
        var element = elem.ownedElements[i]
        if (element instanceof type.UMLClass) {
          innerClass.push(element)
        }
      }
      if (innerClass.length > 0) {
        innerClass = cppCodeGen.classifyVisibility(innerClass)
        writeClassMethod(innerClass)
      }
    }

    var fullPath, file

    // Package -> as namespace or not
    if (elem instanceof type.UMLPackage) {
      fullPath = path.join(basePath, elem.name)
      fs.mkdirSync(fullPath)
      if (Array.isArray(elem.ownedElements)) {
        elem.ownedElements.forEach(child => {
          return this.generate(child, fullPath, options)
        })
      }
    } else if (elem instanceof type.UMLClass) {
      // generate class header elem_name.h
      file = getFilePath(_CPP_CODE_GEN_H)
      fs.writeFileSync(file, this.writeHeaderSkeletonCode(elem, options, writeClassHeader))
      // generate class cpp elem_name.cpp
      if (options.genCpp) {
        file = getFilePath(_CPP_CODE_GEN_CPP)
        fs.writeFileSync(file, this.writeBodySkeletonCode(elem, options, writeClassBody))
      }
    } else if (elem instanceof type.UMLInterface) {
      /*
       * interface will convert to class which only contains virtual method and member variable.
       */
      // generate interface header ONLY elem_name.h
      file = getFilePath(_CPP_CODE_GEN_H)
      fs.writeFileSync(file, this.writeHeaderSkeletonCode(elem, options, writeClassHeader))
    } else if (elem instanceof type.UMLEnumeration) {
      // generate enumeration header ONLY elem_name.h
      file = getFilePath(_CPP_CODE_GEN_H)
      fs.writeFileSync(file, this.writeHeaderSkeletonCode(elem, options, writeEnumeration))
    }
    else if (elem instanceof type.UMLClassDiagram) {
      // generate ClassDiagram header ONLY elem_name.h
      file = getFilePath(_CPP_CODE_GEN_H)
      fs.writeFileSync(file, this.writeHeaderSkeletonCode(elem, options, writeClassDiagram))
    }
  }

  /**
   * Write *.h file. Implement functor to each uml type.
   * Returns text
   *
   * @param {Object} elem
   * @param {Object} options
   * @param {Object} funct
   * @return {string}
   */
  writeHeaderSkeletonCode (elem, options, funct) {
    var headerString = '_' + elem.name.toUpperCase() + '_H'
    var codeWriter = new codegen.CodeWriter(this.getIndentString(options))
    var includePart = this.getIncludePart(elem)
    codeWriter.writeLine(this.genDocHeader(elem, elem.name + '.' + _CPP_CODE_GEN_H))
    codeWriter.writeLine()
    codeWriter.writeLine('#ifndef ' + headerString)
    codeWriter.writeLine('#define ' + headerString)
    codeWriter.writeLine()

    if (includePart.length > 0) {
      codeWriter.writeLine(includePart)
      codeWriter.writeLine()
    }

    funct(codeWriter, elem, this)

    codeWriter.writeLine()
    codeWriter.writeLine('#endif //' + headerString)
    return codeWriter.getData()
  }

  /**
   * Write *.cpp file. Implement functor to each uml type.
   * Returns text
   *
   * @param {Object} elem
   * @param {Object} options
   * @param {Object} functor
   * @return {Object} string
   */
  writeBodySkeletonCode (elem, options, funct) {
    var codeWriter = new codegen.CodeWriter(this.getIndentString(options))
    codeWriter.writeLine(this.genDocHeader(elem, elem.name + '.' + _CPP_CODE_GEN_CPP))
    codeWriter.writeLine()
    codeWriter.writeLine('#include "' + elem.name + '.h"')
    codeWriter.writeLine()
    funct(codeWriter, elem, this)
    return codeWriter.getData()
  }

  /**
   * Parsing template parameter
   *
   * @param {Object} elem
   * @return {Object} string
   */
  getTemplateParameter (elem) {
    var i
    var returnTemplateString = ''
    if (elem.templateParameters.length <= 0) {
      return returnTemplateString
    }
    var term = []
    returnTemplateString = 'template<'
    for (i = 0; i < elem.templateParameters.length; i++) {
      var template = elem.templateParameters[i]
      var templateStr = template.parameterType + ' '
      templateStr += template.name + ' '
      if (template.defaultValue.length !== 0) {
        templateStr += ' = ' + template.defaultValue
      }
      term.push(templateStr)
    }
    returnTemplateString += term.join(', ')
    returnTemplateString += '>'
    return returnTemplateString
  };

  /**
   * Parsing include header
   *
   * @param {Object} elem
   * @return {Object} string
   */
  getIncludePart (elem) {
    var i
    var trackingHeader = (elem, target) => {
      var header = ''
      var elementString = ''
      var targetString = ''
      var i

      while (elem._parent._parent !== null) {
        elementString = (elementString.length !== 0) ? elem.name + '/' + elementString : elem.name
        elem = elem._parent
      }
      while (target._parent._parent !== null) {
        targetString = (targetString.length !== 0) ? target.name + '/' + targetString : target.name
        target = target._parent
      }

      var idx
      for (i = 0; i < (elementString.length < targetString.length) ? elementString.length : targetString.length; i++) {
        if (elementString[i] === targetString[i]) {
          if (elementString[i] === '/' && targetString[i] === '/') {
            idx = i + 1
          }
        } else {
          break
        }
      }

      // remove common path
      elementString = elementString.substring(idx, elementString.length)
      targetString = targetString.substring(idx, targetString.length)
      for (i = 0; i < elementString.split('/').length - 1; i++) {
        header += '../'
      }
      header += targetString
      return header
    }

    var headerString = ''
    if (app.repository.getRelationshipsOf(elem).length <= 0) {
      return ''
    }
    var associations = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel instanceof type.UMLAssociation)
    })
    var realizations = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel instanceof type.UMLInterfaceRealization || rel instanceof type.UMLGeneralization)
    })
    var dependencys = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel instanceof type.UMLDependency)
    })

    
    // check for interface or class
    if (dependencys.length > 0) {
      headerString += '// Realizations\n'
      for (i = 0; i < realizations.length; i++) {
        var realize = realizations[i]
        if (realize.target === elem) {
          continue
        }
        headerString += '#include "' + trackingHeader(elem, realize.target) + '.h"\n'
      }
    }

    // check for dependency
    if (dependencys.length > 0 || associations.length > 0) {
      headerString += '// Dependencys\n'
      for (i = 0; i < dependencys.length; i++) {
        var realize = dependencys[i]
        if (realize.target === elem) {
          continue
        }
        headerString += '#include "' + trackingHeader(elem, realize.target) + '.h"\n'
      }
    
      // check for member variable
      for (i = 0; i < associations.length; i++) {
        var asso = associations[i]
        var target
        if (asso.end1.reference === elem && asso.end2.navigable === true && asso.end2.name.length !== 0) {
          target = asso.end2.reference
        } else if (asso.end2.reference === elem && asso.end1.navigable === true && asso.end1.name.length !== 0) {
          target = asso.end1.reference
        } else {
          continue
        }
        if (target === elem) {
          continue
        }
        headerString += '#include "' + trackingHeader(elem, target) + '.h"\n'
      }
    } // check for dependency
    return headerString
  }

  /**
   * Classfy method and attribute by accessor.(public, private, protected)
   *
   * @param {Object} items
   * @return {Object} list
   */
  classifyVisibility (items) {
    var publicList = []
    var protectedList = []
    var privateList = []
    var i
    for (i = 0; i < items.length; i++) {
      var item = items[i]
      var visib = this.getVisibility(item)

      if (visib === 'public') {
        publicList.push(item)
      } else if (visib === 'private') {
        privateList.push(item)
      } else {
        // if modifier not setted, consider it as protected
        protectedList.push(item)
      }
    }
    return {
      _public: publicList,
      _protected: protectedList,
      _private: privateList
    }
  }

  /**
   * generate variables from attributes[i]
   *
   * @param {Object} elem
   * @return {Object} string
   */
  getMemberVariable (elem) {
    if (elem.name.length > 0) {
      var terms = []
      // doc
      var docs = ''
      docs += '\n@brief ' + elem.documentation.trim()
      docs = this.getMemberDocuments(docs)
      
      // modifiers
      var _modifiers = this.getModifiers(elem)
      if (_modifiers.length > 0) {
        terms.push(_modifiers.join(' '))
      }
      // type
      terms.push(this.getType(elem))
      // name
      terms.push(elem.name)
      // initial value
      if (elem.defaultValue && elem.defaultValue.length > 0) {
        terms.push('= ' + elem.defaultValue)
      }
      return ('\n' + docs + this.tabString + terms.join(' ') + ';')
    }
  }

  /**
   * generate methods from operations[i]
   *
   * @param {Object} elem
   * @param {boolean} isCppBody
   * @return {Object} string
   */
  getMethod (elem, isCppBody) {
    if (elem.name.length > 0) {
      var docs = ''
      var i
      var methodStr = ''
      // var isVirtaul = false
      // TODO virtual fianl static 키워드는 섞어 쓸수가 없다
      if (elem.isStatic === true) {
        methodStr += 'static '
      } else if (elem.isAbstract === true) {
        methodStr += 'virtual '
      }

      // doc brief
      docs += '\n@brief \n'+ elem.documentation.trim() + '\n\n'

      var returnTypeParam = elem.parameters.filter(function (params) {
        return params.direction === 'return'
      })
      var inputParams = elem.parameters.filter(function (params) {
        return ['in', 'out', 'inout'].includes(params.direction)
      })

      // inParam
      var inputParamStrings = []
      if (inputParams.length > 0) {
        for (i = 0; i < inputParams.length; i++) {
          var inputParam = inputParams[i]
          var paramType = this.getType(inputParam)
          inputParamStrings.push(paramType + ' ' + inputParam.name)
          //doc 
          var paramDirect = inputParam.direction
          if (paramDirect == 'inout') paramDirect = 'in, out'
          docs += '@param[' + paramDirect + '] ' + inputParam.name + ' '
          if (inputParam.documentation) {
            var paramName = this.getBrief(inputParam.documentation);
            var paramDtl = this.getDetails(inputParam.documentation);
            docs += this.getBrief(inputParam.documentation)
            if (paramDtl.length > 0)
              docs += '\n' + this.addTabString(this.getDetails(inputParam.documentation))
          }
          docs += '\n'
        }
        docs+='\n'
      }
      // retParam doc
      if (returnTypeParam.length > 0) {
        for (i = 0; i < returnTypeParam.length; i++) {
          var retParam = returnTypeParam[i]
          //doc 
          docs += '@return ' + retParam.defaultValue + ' '
          if (retParam.documentation) {
            var retName = this.getBrief(retParam.documentation);
            var retDtl = this.getDetails(retParam.documentation);
            docs += this.getBrief(retParam.documentation)
            if (paramDtl.length > 0)
              docs += '\n' + this.addTabString(this.getDetails(retParam.documentation))
          }
          docs += '\n'
        }
        docs+='\n'
      }

      methodStr += ((returnTypeParam.length > 0) ? this.getType(returnTypeParam[0]) : 'void') + ' '

      if (isCppBody) {
        var telem = elem
        var specifier = ''

        while (telem._parent instanceof type.UMLClass) {
          specifier = telem._parent.name + '::' + specifier
          telem = telem._parent
        }

        var indentLine = ''

        for (i = 0; i < this.genOptions.indentSpaces; i++) {
          indentLine += ' '
        }

        methodStr += specifier
        methodStr += elem.name
        methodStr += '(' + inputParamStrings.join(', ') + ')' + ' {\n'
        if (returnTypeParam.length > 0) {
          var returnType = this.getType(returnTypeParam[0])
          if (returnType === 'boolean' || returnType === 'bool') {
            methodStr += indentLine + 'return false;'
          } else if (returnType === 'int' || returnType === 'long' || returnType === 'short' || returnType === 'byte') {
            methodStr += indentLine + 'return 0;'
          } else if (returnType === 'double' || returnType === 'float') {
            methodStr += indentLine + 'return 0.0;'
          } else if (returnType === 'char') {
            methodStr += indentLine + "return '0';"
          } else if (returnType === 'string' || returnType === 'String') {
            methodStr += indentLine + 'return "";'
          } else if (returnType === 'void') {
            methodStr += indentLine + 'return;'
          } else {
            methodStr += indentLine + 'return null;'
          }
          // docs += '\n@return ' + returnType
        }
        methodStr += '\n}'
        docs = this.getDocuments(docs)
      } else {
        methodStr += elem.name
        methodStr += '(' + inputParamStrings.join(', ') + ')'
        if (elem.isLeaf === true) {
          methodStr += ' final'
        } else if (elem.isAbstract === true) { // TODO 만약 virtual 이면 모두 pure virtual? 체크 할것
          methodStr += ' = 0'
        }
        methodStr += ';'
        methodStr = this.tabString + methodStr
        docs = this.getMemberDocuments(docs)
      }
      return '\n' + docs + methodStr
    }
  }

  // the first line of text
  getBrief (text) {
    if (text.length>0) {
      return text.trim().split('\n')[0];
    }
    return ''
  }

  // the text start from the second line to the end
  getDetails (text) {
    if (text.length>0) {
      var lines = text.trim().split('\n')
      if (lines.length < 2) return ''
      var docs = ''
      var i = 1
      if (lines.length > 1){
        for (i = 1; i < lines.length-1; i++) {
          docs += lines[i] + '\n'
        }
      }
      docs += lines[i]
      return docs
    }
    return ''
  }

  /**
   * generate doc string from doc element
   *
   * @param {Object} text
   * @return {Object} string
   */
  getDocuments (text) {
    var docs = ''
    if ((typeof text === 'string') && text.length !== 0) {
      var lines = text.trim().split('\n')
      docs += '/**\n'
      var i
      for (i = 0; i < lines.length; i++) {
        docs += ' * ' + lines[i] + '\n'
      }
      docs += ' */\n'
    }
    return docs
  }

  /**
   * generate member doc string from doc element
   *
   * @param {Object} text
   * @return {Object} string
   */
  getMemberDocuments (text) {
    var docs = ''
    if ((typeof text === 'string') && text.length !== 0) {
      var lines = text.trim().split('\n')
      docs += this.tabString + '/**\n'
      var i
      for (i = 0; i < lines.length; i++) {
        docs += this.tabString + ' * ' + lines[i] + '\n'
      }
      docs += this.tabString + ' */\n'
    }
    return docs
  }

  /**
   * generate member doc string from doc element
   *
   * @param {Object} text
   * @return {Object} string
   */
  addTabString (text) {
    var docs = ''
    if ((typeof text === 'string') && text.length !== 0) {
      var lines = text.trim().split('\n')
      var i = 0
      if (lines.length>1) {
        for (i = 0; i < lines.length-1; i++) {
          docs += this.tabString + lines[i] + '\n'
        }
      }
      docs += this.tabString + lines[i]
    }
    return docs
  }

  /**
   * parsing visibility from element
   *
   * @param {Object} elem
   * @return {Object} string
   */
  getVisibility (elem) {
    switch (elem.visibility) {
    case type.UMLModelElement.VK_PUBLIC:
      return 'public'
    case type.UMLModelElement.VK_PROTECTED:
      return 'protected'
    case type.UMLModelElement.VK_PRIVATE:
      return 'private'
    }
    return null
  }

  /**
   * parsing modifiers from element
   *
   * @param {Object} elem
   * @return {Object} list
   */
  getModifiers (elem) {
    var modifiers = []
    if (elem.isStatic === true) {
      modifiers.push('static')
    }
    if (elem.isReadOnly === true) {
      modifiers.push('const')
    }
    if (elem.isAbstract === true) {
      modifiers.push('virtual')
    }
    return modifiers
  }

  /**
   * parsing type from element
   *
   * @param {Object} elem
   * @return {Object} string
   */
  getType (elem) {
    var _type = 'void'
    if (elem instanceof type.UMLAssociationEnd) { // member variable from association
      if (elem.reference instanceof type.UMLModelElement && elem.reference.name.length > 0) {
        _type = elem.reference.name
      }
    } else { // member variable inside class
      if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
        _type = elem.type.name
      } else if ((typeof elem.type === 'string') && elem.type.length > 0) {
        _type = elem.type
      }
    }

    // string => std::string
    if (['string', 'String'].includes(_type)) {
        _type = 'std::string';
    }

    // class => std::Ptr<class>
    var refTypeMap = new Map([['none', 'std::weak_ptr'], ['shared','std::shared_ptr'], ['composite','std::shared_ptr']])

    if (elem instanceof type.UMLParameter) {
      if (elem.type instanceof type.UMLClass || _type == 'void') {
        _type = 'std::shared_ptr<' + _type + '>';
      }
    } else if (elem instanceof type.UMLAttribute) {
      if (elem.type instanceof type.UMLClass) {
        _type = refTypeMap.get(elem.aggregation)+'<' + _type + '>';
      }
    } else if (elem instanceof type.UMLAssociationEnd) {
      var anotherEnd = elem._parent.end1;
      if ( elem == anotherEnd ) anotherEnd = elem._parent.end2;
      if (refTypeMap.has(anotherEnd.aggregation))
        _type = refTypeMap.get(anotherEnd.aggregation)+'<' + _type + '>';
    }
    

    // multiplicity
    if (elem.multiplicity) {
      if (['0..*', '1..*', '*'].includes(elem.multiplicity.trim())) {
        if (elem.isOrdered === true) {
          _type = 'std::vector<' + _type + '>'
        } else {
          _type = 'std::vector<' + _type + '>'
        }
      } else if (elem.multiplicity !== '1' && elem.multiplicity.match(/^\d+$/)) { // number
        // TODO check here
        _type += '[]'
      }
    }

    // UMLParameter
    if (elem instanceof type.UMLParameter){
      if (elem.type instanceof type.UMLClass || _type.indexOf('std::') != -1 ) { _type += '&';} // std::string std::vector ...
      else if (['out', 'inout'].includes(elem.direction)) { _type += '&';} // int char ...

      if (['in'].includes(elem.direction)) { _type = 'const ' + _type;}
    }
    return _type
  }

  /**
   * get all super class / interface from element
   *
   * @param {Object} elem
   * @return {Object} list
   */
  getSuperClasses (elem) {
    var generalizations = app.repository.getRelationshipsOf(elem, function (rel) {
      return ((rel instanceof type.UMLGeneralization || rel instanceof type.UMLInterfaceRealization) && rel.source === elem)
    })
    return generalizations
  }
}

function generate (baseModel, basePath, options) {
  var cppCodeGenerator = new CppCodeGenerator(baseModel, basePath)
  cppCodeGenerator.generate(baseModel, basePath, options)
}

function getVersion () { return versionString }

exports.generate = generate
exports.getVersion = getVersion
