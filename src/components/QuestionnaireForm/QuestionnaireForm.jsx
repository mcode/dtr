import React, { Component } from "react";
import cql from "cql-execution";
import "./QuestionnaireForm.css";
import { findValueByPrefix } from "../../util/util.js";

export default class QuestionnaireForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      containedResources: null,
      items: null,
      itemTypes: {},
      values: {
        "1.1": "henlo"
      },
      orderedLinks: [],
      sectionLinks: {},
      fullView: true,
      turnOffValues: [],
      useSavedResponse: false,
      savedResponse: null
    };

    this.outputResponse = this.outputResponse.bind(this);
    this.smart = props.smart;
    this.fhirVersion = props.fhirVersion;
    this.FHIR_PREFIX = props.FHIR_PREFIX;
  }

  componentWillMount() {
    // setup
    // get all contained resources
    let partialResponse = localStorage.getItem(this.props.qform.id);
    let saved_response = false;

    if (partialResponse) {
      let result = confirm(
        "Found previously saved form. Do you want to load existing data from saved from?"
      );

      if (result) {
        //this.state.savedResponse = JSON.parse(partialResponse);
        this.setState({ savedResponse: JSON.parse(partialResponse) })
        saved_response = true;
      } else {
        localStorage.removeItem(this.props.qform.id);
      }
    }

    // If not using saved QuestionnaireResponse, create a new one
    let newResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'draft',
      item: []
    }

    const items = this.props.qform.item;
    this.prepopulate(items, newResponse.item, saved_response)

    if (!saved_response) {
      this.state.savedResponse = newResponse
    }
  }

  componentDidMount() {
    console.log(JSON.stringify(this.props.qform));
    console.log(JSON.stringify(this.state.savedResponse));
    let lform = LForms.Util.convertFHIRQuestionnaireToLForms(this.props.qform, this.props.fhirVersion);

    lform.templateOptions = {
      showFormHeader: false,
      showColumnHeaders: false,
      showQuestionCode: false,
      hideFormControls: true,
      showFormOptionPanelButton: true//,
      //allowHTMLInInstructions: true,
      //showCodingInstruction: true
    };

    if (this.state.savedResponse) {
      lform = LForms.Util.mergeFHIRDataIntoLForms("QuestionnaireResponse", this.state.savedResponse, lform, this.props.fhirVersion)
    }

    console.log(JSON.stringify(lform));
    LForms.Util.addFormToPage(lform, "formContainer")
  }

  prepopulate(items, response_items, saved_response) {
    items.map(item => {
      let response_item = {
        linkId: item.linkId,
      };

      if (item.item) {
        // add sub-items
        response_item.item = []
        this.prepopulate(item.item, response_item.item, saved_response);

        // Remove empty child item array
        if (response_item.item.length == 0) {
          response_item.item = undefined
        }
      }

      if (item.type === 'choice' || item.type === 'open-choice') {
        this.populateChoices(item)
      }

      // autofill fields
      if (item.extension && (!saved_response || item.type == 'open-choice')) {
        response_item.answer = []
        item.extension.forEach(e => {
          let value;
          if (
            e.url ===
            "http://hl7.org/fhir/StructureDefinition/cqif-calculatedValue"
          ) {
            // stu3
            value = findValueByPrefix(e, "value");
          } else if (
            e.url === "http://hl7.org/fhir/StructureDefinition/cqf-expression"
          ) {
            // r4
            value = findValueByPrefix(e, "value");
            value = value.expression;
          } else {
            // not a cql statement reference
            return;
          }

          // split library designator from statement
          const valueComponents = value.split(".");
          let libraryName;
          let statementName;
          if (valueComponents.length > 1) {
            libraryName = valueComponents[0].substring(
              1,
              valueComponents[0].length - 1
            );
            statementName = valueComponents[1];
          } else {
            // if there is not library name grab the first library name
            statementName = value;
            libraryName = Object.keys(this.props.cqlPrepoulationResults)[0];
          }
          // grab the population result
          let prepopulationResult;
          if (this.props.cqlPrepoulationResults[libraryName] != null) {
            prepopulationResult = this.props.cqlPrepoulationResults[
              libraryName
            ][statementName];
          } else {
            prepopulationResult = null;
            console.log(`Couldn't find library "${libraryName}"`);
          }

          if (prepopulationResult != null && !saved_response) {
            switch (item.type) {
              case 'boolean':
                response_item.answer.push({ valueBoolean: prepopulationResult });
                break;

              case 'integer':
                response_item.answer.push({ valueInteger: prepopulationResult });
                break;

              case 'decimal':
                response_item.answer.push({ valueDecimal: prepopulationResult });
                break;

              case 'date':
                // LHC form could not correctly parse Date object.
                // Have to convert Date object to string. 
                response_item.answer.push({ valueDate: prepopulationResult.toString() });
                break;

              case 'choice':
                response_item.answer.push({ valueCoding: this.getDisplayCoding(prepopulationResult, item) });
                break;

              case 'open-choice':
                //This is to populated dynamic options (option items generated from CQL expression)
                //R4 uses item.answerOption, STU3 uses item.option
                let populateAnswerOptions = false;
                let populateOptions = false;

                if (item.answerOption != null && item.answerOption.length == 0) {
                  populateAnswerOptions = true
                } else if (item.option != null && item.option.length == 0) {
                  populateOptions = true
                }

                prepopulationResult.forEach(v => {
                  let displayCoding = this.getDisplayCoding(v, item)

                  if (populateAnswerOptions) {
                    item.answerOption.push({ valueCoding: displayCoding })
                  } else if (populateOptions) {
                    item.option.push({ valueCoding: displayCoding })
                  }

                  response_item.answer.push({ valueCoding: displayCoding });
                });
                break;

              case 'quantity':
                response_item.answer.push({ valueQuantity: prepopulationResult });
                break;

              default:
                response_item.answer.push({ valueString: prepopulationResult });
            }
          }
        });

        // Remove emtpy answer array
        if (response_item.answer.length == 0) {
          response_item.answer = undefined
        }
      }
      
      // Don't need to add item for reloaded QuestionnaireResponse 
      // Add QuestionnaireReponse item if the item has either answer(s) or child item(s)
      if (!saved_response && (response_item.answer || response_item.item)) {
        response_items.push(response_item);
      }
    });
  }

  getDisplayCoding(v, item) {
    if (typeof v == 'string') {
      const answerValueSetReference = item.answerValueSet || (item.options || {}).reference
      const answerOption = item.answerOption || item.option
      let selectedCode;

      if (answerValueSetReference && this.props.qform.contained) {
        const vs_id = answerValueSetReference.substr(1);
        const vs = this.props.qform.contained.find(r => r.id == vs_id);
        if (vs && vs.expansion && vs.expansion.contains) {
          selectedCode = vs.expansion.contains.find(o => o.code == v)
        }
      } else if (answerOption) {
        const ao = answerOption.find(o => o.valueCoding.code == v || o.valueCoding.display == v)
        if (ao) {
          selectedCode = ao.valueCoding
        }
      }

      if (selectedCode) {
        return selectedCode
      } else {
        return {
          display: v
        }
      }
    }

    let system = '';
    let displayText = v.display

    if(v.type && v.type === 'encounter' && v.periodStart) {
      displayText = 'Encounter - ' + v.display + ' on ' + v.periodStart
    } else if (v.system) {
      if (v.system == 'http://snomed.info/sct') {
        system = 'SNOMED'
      } else if (v.system.startsWith('http://hl7.org/fhir/sid/icd-10')) {
        system = "ICD-10"
      } else if (v.system == "http://www.nlm.nih.gov/research/umls/rxnorm") {
        system = "RxNorm"
      }

      if (system.length > 0) {
        displayText = displayText + ' - ' + system + ' - ' + v.code      
      }
    }

    return {
      code: v.code,
      system: v.system,
      display: displayText
    }
  }

  populateMissingDisplay(codingList) {
    if (codingList) {
      codingList.forEach(v => {
        if (v.valueCoding && !v.valueCoding.display) {
          v.valueCoding.display = v.valueCoding.code
        }
      })
    }
  }

  populateChoices(item) {
    if (this.props.fhirVersion === 'STU3') {
      this.populateMissingDisplay(item.option)
    } else {
      this.populateMissingDisplay(item.answerOption)
    }
  }

  storeQuestionnaireResponseToEhr(questionnaireReponse) {
    // send the QuestionnaireResponse to the EHR FHIR server
    var questionnaireUrl = sessionStorage["serviceUri"] + "/QuestionnaireResponse";
    console.log("Storing QuestionnaireResponse to: " + questionnaireUrl);
    this.smart.create(questionnaireReponse);
}

  generateAndStoreDocumentReference(questionnaireResponse, dataBundle) {
    var pdfMake = require("pdfmake/build/pdfmake.js");
    var pdfFonts = require("pdfmake/build/vfs_fonts.js");
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    var docDefinition = {
      content: [
        {
          text:
            "QuestionnaireResponse: " +
            questionnaireResponse.id +
            " (" +
            questionnaireResponse.authored +
            ")\n",
          style: "header"
        },
        {
          text: JSON.stringify(questionnaireResponse, undefined, 4),
          style: "body"
        }
      ],
      styles: {
        header: {
          fontSize: 13,
          bold: true
        },
        body: {
          fontSize: 8,
          bold: false,
          preserveLeadingSpaces: true
        }
      }
    };

    // create the DocumentReference and generate a PDF
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    //pdfDocGenerator.open();
    pdfDocGenerator.getBase64(b64pdf => {
      const documentReference = {
        resourceType: "DocumentReference",
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org",
              code: "55107-7",
              display: "Addendum Document"
            }
          ]
        },
        description: "PDF containing a QuestionnaireResponse",
        indexed: new Date().toISOString(),
        subject: { reference: this.makeReference(dataBundle, "Patient") },
        author: { reference: this.makeReference(dataBundle, "Practitioner") },
        content: [
          {
            attachment: {
              data: b64pdf,
              contentType: "application/pdf"
            }
          }
        ]
      };
      console.log(documentReference);

      // send the DocumentReference to the EHR FHIR server
      var docReferenceUrl = sessionStorage["serviceUri"] + "/DocumentReference";
      console.log("Storing DocumentReference to: " + docReferenceUrl);

      const Http = new XMLHttpRequest();
      Http.open("POST", docReferenceUrl);
      Http.setRequestHeader("Content-Type", "application/fhir+json");
      Http.send(JSON.stringify(documentReference));
      Http.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
          if (this.status == 201) {
            console.log(
              "Successfully stored DocumentReference ID: " +
              JSON.parse(this.response).id
            );
          } else {
            console.log(
              "WARNING: something may be wrong with the DocumentReference storage response:"
            );
            console.log(this.response);
          }
        }
      };
    });
  }

  getQuestionnaireResponse(status) {
    var qr = window.LForms.Util.getFormFHIRData('QuestionnaireResponse', 'R4');
    qr.status = status;
    qr.author = {
      reference:
        "Practitioner/" +
        this.props.cqlPrepoulationResults.BasicPractitionerInfoPrepopulation
          .OrderingProvider.id.value
    };

    qr.questionnaire = this.props.qform.id;

    return qr;
  }

  sendQuestionnaireResponseToPayer() {
    console.log(this.state.sectionLinks);
    var qr = this.getQuestionnaireResponse("completed");

    // do a fetch back to the dtr server to post the QuestionnaireResponse to CRD
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(qr)
    };

    function handleFetchErrors(response) {
      if (!response.ok) {
        let msg = "Failure when fetching resource";
        let details = `${msg}: ${response.url}: the server responded with a status of ${response.status} (${response.statusText})`;
        console.log(msg + ": errorClass: " + details);
      }
      return response;
    }

    console.log(requestOptions);
    let url = this.FHIR_PREFIX + this.fhirVersion + "/QuestionnaireResponse";
    console.log(url);
    fetch(url, requestOptions).then(handleFetchErrors).then(r => {
        let msg = "QuestionnaireResponse sent to Payer";
        console.log(msg);
        alert(msg);
      })
      .catch(err => {
        console.log("error sending new QuestionnaireResponse to the Payer: ", err);
      });
    
    return;
  }

  // create the questionnaire response based on the current state
  outputResponse(status) {
    console.log(this.state.sectionLinks);

    var qr = this.getQuestionnaireResponse(status);

    if (status == "in-progress") {
      localStorage.setItem(qr.questionnaire, JSON.stringify(qr));
      alert("Partial QuestionnaireResponse saved");
      console.log("Partial QuestionnaireResponse saved.");
      return;
    }

    // For HIMSS Demo with Mettle always use GCS as payor info
    const insurer = {
      resourceType: "Organization",
      id: "org1234",
      name: "GCS",
      identifier: [
        {
          system: "urn:ietf:rfc:3986",
          value: "2.16.840.1.113883.13.34.110.1.150.2"
        }
      ]
    };
    const managingOrg = {
      resourceType: "Organization",
      id: "org1111",
      name: "Byrd-Watson",
      identifier: [
        {
          system: "http://hl7.org/fhir/sid/us-npi",
          value: "1437147246"
        }
      ],
      address: [
        {
          use: "work",
          state: "IL",
          postalCode: "62864",
          city: "Mount Vernon",
          line: ["1200 Main St"]
        }
      ]
    };
    const facility = {
      resourceType: "Location",
      id: "loc1234",
      type: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: "IEC",
              display: "Impairment evaluation center"
            }
          ]
        }
      ],
      managingOrganization: {
        reference: "Organization/org1111"
      }
    };

    const priorAuthBundle = JSON.parse(JSON.stringify(this.props.bundle));
    priorAuthBundle.entry.unshift({ resource: managingOrg });
    priorAuthBundle.entry.unshift({ resource: facility });
    priorAuthBundle.entry.unshift({ resource: insurer });
    priorAuthBundle.entry.unshift({ resource: this.props.deviceRequest });
    priorAuthBundle.entry.unshift({ resource: qr });
    console.log(priorAuthBundle);

    this.generateAndStoreDocumentReference(qr, priorAuthBundle);
    this.storeQuestionnaireResponseToEhr(qr);

    // if (this.props.priorAuthReq) {
    const priorAuthClaim = {
      resourceType: "Claim",
      status: "active",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/claim-type",
            code: "professional",
            display: "Professional"
          }
        ]
      },
      subType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/ex-claimsubtype",
            code: "HIMSS",
            display: "Example subType code for HIMSS demo"
          }
        ]
      },
      use: "preauthorization",
      patient: { reference: this.makeReference(priorAuthBundle, "Patient") },
      created: qr.authored,
      provider: {
        reference: this.makeReference(priorAuthBundle, "Practitioner")
      },
      insurer: {
        reference: this.makeReference(priorAuthBundle, "Organization")
      },
      facility: {
        reference: this.makeReference(priorAuthBundle, "Location")
      },
      priority: { coding: [{ code: "normal" }] },
      prescription: {
        reference: this.makeReference(priorAuthBundle, "DeviceRequest")
      },
      careTeam: [
        {
          sequence: 1,
          provider: {
            reference: this.makeReference(priorAuthBundle, "Practitioner")
          },
          extension: [
            {
              url: "http://terminology.hl7.org/ValueSet/v2-0912",
              valueCode: "OP"
            }
          ]
        }
      ],
      supportingInfo: [
        {
          sequence: 1,
          category: {
            coding: [
              {
                system:
                  "http://hl7.org/us/davinci-pas/CodeSystem/PASSupportingInfoType",
                code: "patientEvent"
              }
            ]
          },
          timingPeriod: {
            start: "2020-01-01",
            end: "2021-01-01"
          }
        },
        {
          sequence: 2,
          category: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/claiminformationcategory",
                code: "info",
                display: "Information"
              }
            ]
          },
          valueReference: {
            reference: this.makeReference(
              priorAuthBundle,
              "QuestionnaireResponse"
            )
          }
        }
      ],
      item: [
        {
          sequence: "1",
          productOrService: this.props.deviceRequest.codeCodeableConcept,
          quantity: {
            value: 1
          }
        }
      ],
      diagnosis: [],
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: this.makeReference(priorAuthBundle, "Coverage")
          }
        }
      ]
    };
    var sequence = 1;
    priorAuthBundle.entry.forEach(function (entry, index) {
      if (entry.resource.resourceType == "Condition") {
        priorAuthClaim.diagnosis.push({
          sequence: sequence++,
          diagnosisReference: { reference: "Condition/" + entry.resource.id }
        });
      }
    });
    console.log(priorAuthClaim);

    priorAuthBundle.entry.unshift({ resource: priorAuthClaim });
    console.log(priorAuthBundle);

    this.props.setPriorAuthClaim(priorAuthBundle);
    // } else {
    //   alert("NOT submitting for prior auth");
    // }
    localStorage.removeItem(qr.questionnaire);
  }

  isEmptyAnswer(answer) {
    return (
      answer.length < 1 ||
      JSON.stringify(answer[0]) == "{}" ||
      (answer[0].hasOwnProperty("valueString") &&
        (answer[0].valueString == null || answer[0].valueString == "")) ||
      (answer[0].hasOwnProperty("valueDateTime") &&
        (answer[0].valueDateTime == null || answer[0].valueDateTime == "")) ||
      (answer[0].hasOwnProperty("valueDate") &&
        (answer[0].valueDate == null || answer[0].valueDate == "")) ||
      (answer[0].hasOwnProperty("valueBoolean") &&
        answer[0].valueBoolean == null) ||
      (answer[0].hasOwnProperty("valueQuantity") &&
        (answer[0].valueQuantity == null ||
          answer[0].valueQuantity.value == null ||
          answer[0].valueQuantity.value == ""))
    );
  }

  makeReference(bundle, resourceType) {
    var entry = bundle.entry.find(function (entry) {
      return entry.resource.resourceType == resourceType;
    });
    return resourceType + "/" + entry.resource.id;
  }

  render() {
    return (
      <div>
        <div id="formContainer">
        </div>
        <div className="submit-button-panel">
          <button className="btn submit-button" onClick={this.sendQuesionnaireResponseToPayer.bind(this)}>
            Send to Payer
          </button>
          <button className="btn submit-button" onClick={this.outputResponse.bind(this, "in-progress")}>
            Save
          </button>
          <button className="btn submit-button" onClick={this.outputResponse.bind(this, "completed")}>
            Next
          </button>
        </div>
      </div>
    );
  }
}
