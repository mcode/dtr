import React, { Component } from "react";
import ResourceEntry from './ResourceEntry';
import "./RemsInterface.css";
import axios from "axios";
import { SystemUpdateTwoTone } from "@material-ui/icons";
import Paper from "@material-ui/core/Paper";
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import Button from '@material-ui/core/Button';
import AutorenewIcon from '@material-ui/icons/Autorenew';
const colorPicker = {
  "Pending": "#f0ad4e",
  "Approved": "#5cb85c",
}
export default class RemsInterface extends Component {

  constructor(props) {
    super(props);
    this.state = {
      claimResponseBundle: null,
      remsAdminResponse: null,
      response: null,
      spin: false,
      spinPis: false,
      viewResponse: false,
      viewBundle: false,
      viewPisBundle: false,
    };

    this.getAxiosOptions = this.getAxiosOptions.bind(this);
    this.sendRemsMessage = this.sendRemsMessage.bind(this);
    this.renderBundle = this.renderBundle.bind(this);
    this.refreshBundle = this.refreshBundle.bind(this);
    this.refreshPisBundle = this.refreshPisBundle.bind(this);
    this.toggleBundle = this.toggleBundle.bind(this);
    this.toggleResponse = this.toggleResponse.bind(this);

    this.togglePisBundle = this.togglePisBundle.bind(this);
  }

  componentDidMount() {
    this.sendRemsMessage();
  }
  getAxiosOptions() {
    const options = {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    };
    return options;
  }

  unfurlJson(jsonData) {
    console.log(jsonData);
    return jsonData.metRequirements.map(metReq => {
      console.log(metReq);
      return (
        <div>
          <div className={"resource-entry etasu-container"}>
            <div className={"resource-entry-text"}  >{metReq.requirementName}</div>
              <div className={"resource-entry-icon"}>{metReq.completed ? "✅"  : "❌"}</div>
            <div className={"resource-entry-hover"}>{metReq.requirementDescription}</div>
          </div>
        </div>
      )
    });

  }

  getResource(bundle, resourceReference) {
    let temp = resourceReference.split("/");
    let _resourceType = temp[0];
    let _id = temp[1];

    for (let i = 0; i < bundle.entry.length; i++) {
      if ((bundle.entry[i].resource.resourceType === _resourceType)
        && (bundle.entry[i].resource.id === _id)) {
        return bundle.entry[i].resource;
      }
    }
    return null;
  }
  
  async sendRemsMessage() {
    const remsAdminResponse = await axios.post("http://localhost:8090/etasu/met", this.props.specialtyRxBundle, this.getAxiosOptions());
    console.log(remsAdminResponse)    
    this.setState({ remsAdminResponse });
    
    //  Will not send post request to PIS if only for patient enrollment
    if(this.state.remsAdminResponse?.data?.case_number){

      // extract params and questionnaire response identifier
      let params = this.getResource(this.props.specialtyRxBundle, this.props.specialtyRxBundle.entry[0].resource.focus.parameters.reference);

      // stakeholder and medication references
      let prescriptionReference = "";
      let patientReference = "";
      for (let param of params.parameter) {
        if (param.name === "prescription") {
          prescriptionReference = param.reference;
        }
        else if (param.name === "source-patient") {
          patientReference = param.reference;
        }
      }

      // obtain drug information from database
      let presciption = this.getResource(this.props.specialtyRxBundle, prescriptionReference);
      let simpleDrugName = presciption.medicationCodeableConcept.coding[0].display.split(" ")[0];
      let rxDate = presciption.medicationCodeableConcept.authoredOn;
      let patient = this.getResource(this.props.specialtyRxBundle, patientReference);
      let patientFirstName = patient.name[0].given[0];
      let patientLastName = patient.name[0].family;
      let patientDOB = patient.birthDate;

      // console.log(`http://localhost:5051/doctorOrders/api/getRx/${patientFirstName}/${patientLastName}/${patientDOB}?simpleDrugName=${simpleDrugName}&rxDate=${rxDate}`);

      axios.get(`http://localhost:5051/doctorOrders/api/getRx/${patientFirstName}/${patientLastName}/${patientDOB}?simpleDrugName=${simpleDrugName}&rxDate=${rxDate}`, remsAdminResponse.data, this.getAxiosOptions()).then((response) => {
        this.setState({ response });
        console.log(response);
        console.log(response.data);
      });
    }

    // const remsAdminResponse = await axios.post("http://localhost:8090/etasu/met", this.props.specialtyRxBundle, this.getAxiosOptions());
    // this.setState({ remsAdminResponse });
    // console.log(remsAdminResponse)
  }

  toggleBundle() {
    this.setState((prevState) => {
      return { ...prevState, viewBundle: !prevState.viewBundle }
    })
  }

  toggleResponse() {
    console.log(this.state.viewResponse);
    this.setState((prevState) => {
      return { ...prevState, viewResponse: !prevState.viewResponse }
    })
  }

  togglePisBundle() {
    this.setState((prevState) => {
      return { ...prevState, viewPisBundle: !prevState.viewPisBundle }
    })
  }

  renderBundle(bundle) {
    return bundle.entry.map((entry) => {
      const resource = entry.resource;
      console.log(resource);
      return (
        <div>
          <ResourceEntry resource={resource}></ResourceEntry>
        </div>
      )
    })
  }

  refreshPisBundle() {
    this.setState({ spinPis: true });
    
    let params = this.getResource(this.props.specialtyRxBundle, this.props.specialtyRxBundle.entry[0].resource.focus.parameters.reference);

    // stakeholder and medication references
    let prescriptionReference = "";
    let patientReference = "";
    for (let param of params.parameter) {
      if (param.name === "prescription") {
        prescriptionReference = param.reference;
      }
      else if (param.name === "source-patient") {
        patientReference = param.reference;
      }
    }

    // obtain drug information from database
    let presciption = this.getResource(this.props.specialtyRxBundle, prescriptionReference);
    let simpleDrugName = presciption.medicationCodeableConcept.coding[0].display.split(" ")[0];
    let rxDate = presciption.medicationCodeableConcept.authoredOn;
    let patient = this.getResource(this.props.specialtyRxBundle, patientReference);
    let patientFirstName = patient.name[0].given[0];
    let patientLastName = patient.name[0].family;
    let patientDOB = patient.birthDate;

    axios.get(`http://localhost:5051/doctorOrders/api/getRx/${patientFirstName}/${patientLastName}/${patientDOB}?simpleDrugName=${simpleDrugName}&rxDate=${rxDate}`)
    .then((response) => {
      this.setState({ response: response });
    })
  }

  refreshBundle() {
    this.setState({ spin: true });
    axios.get(`http://localhost:8090/etasu/met/${this.state.remsAdminResponse.data.case_number}`).then((response) => {
      this.setState({ remsAdminResponse: response });
    })
  }

  render() {
    const status = this.state.remsAdminResponse?.data?.status;
    let color = "#f7f7f7"
    if (status === "Approved") {
      color = "#5cb85c"
    } else if (status === "Pending") {
      color = "#f0ad4e"
    }

    let colorPis = "#f7f7f7"
    const statusPis = this.state.response?.data?.dispenseStatus;

    if (statusPis === "Approved") {
      colorPis = "#5cb85c"
    } else if (statusPis === "Pending") {
      colorPis = "#f0ad4e"
    } else if (statusPis === "Picked Up") {
      colorPis = "#0275d8"
    }

    // Checking if REMS Request (pt enrollment) || Met Requirments (prescriber Form)
    let hasRemsResponse = this.state.remsAdminResponse?.data ? true : false
    let hasRemsCase = this.state.remsAdminResponse?.data?.case_number ? true : false;

    return (
      <div>
        {
          hasRemsResponse ?
          <div>
          {hasRemsCase ?
            <div>
              <div className="container left-form">
                <h1>REMS Admin Status</h1>
                <Paper style={{ paddingBottom: "5px" }}>
                  <div className="status-icon" style={{ backgroundColor: color }}></div>
                  <div className="bundle-entry">
                    Case Number : {this.state.remsAdminResponse?.data?.case_number || "N/A"}
                  </div>
                  <div className="bundle-entry">
                    Status: {this.state.remsAdminResponse?.data?.status}
                  </div>
                  <div className="bundle-entry">
                    <Button variant="contained" onClick={this.toggleBundle}>View Bundle</Button>
                    <Button variant="contained" onClick={this.toggleResponse}>View ETASU</Button>
  
                    {this.state.remsAdminResponse?.data?.case_number ?
                      <AutorenewIcon
                        className={this.state.spin === true ? "refresh" : "renew-icon"}
                        onClick={this.refreshBundle}
                        onAnimationEnd={() => this.setState({ spin: false })}
                      />
                      : ""
                    }
  
                  </div>
  
                </Paper>
                {this.state.viewResponse ?
                  <div className="bundle-view">
                    <br></br>
                    <h3>ETASU</h3>
                    {this.unfurlJson(this.state.remsAdminResponse?.data, 0)}
                  </div>
                  :
                  ""}
                {this.state.viewBundle ? <div className="bundle-view">
                  <br></br>
                  <h3>Bundle</h3>
                  {this.renderBundle(this.props.specialtyRxBundle)}
                </div> : ""}
  
              </div>
  
              <div className="right-form">
                <h1>Pharmacy Status</h1>
                <Paper style={{ paddingBottom: "5px" }}>
                  <div className="status-icon" style={{ backgroundColor: colorPis }}></div>
                  <div className="bundle-entry">
                    ID : {this.state.response?.data?._id || "N/A"}
                  </div>
                  <div className="bundle-entry">
                    Status: {this.state.response?.data?.dispenseStatus}
                  </div>
                  <div className="bundle-entry">
                    {/* <Button variant="contained" onClick={this.togglePisBundle}>View Bundle</Button> */}
                    {this.state.response?.data?._id ?
                      <AutorenewIcon
                        className={this.state.spinPis === true ? "refresh" : "renew-icon"}
                        onClick={this.refreshPisBundle}
                        onAnimationEnd={() => this.setState({ spinPis: false })}
                      />
                      : ""
                    }
                  </div>
  
                </Paper>
                {this.state.viewPisBundle ? <div className="bundle-view">
                  <br></br>
                  <h3>Bundle</h3>
                  {this.renderBundle(this.props.specialtyRxBundle)}
                </div> : ""}
              </div>
            </div>
            :
            <div>
              <div className="container left-form">
                <h1>Prescriber Document Status</h1>
                <Paper style={{ paddingBottom: "5px" }}>
                  <div className="status-icon" style={{ backgroundColor: "#5cb85c" }}></div>
                  <div className="bundle-entry">
                    Status: Documents successfully submitted
                  </div>
                  <div className="bundle-entry">
                    <Button variant="contained" onClick={this.toggleBundle}>View Bundle</Button>
  
                    {this.state.remsAdminResponse?.data?.case_number ?
                      <AutorenewIcon
                        className={this.state.spin === true ? "refresh" : "renew-icon"}
                        onClick={this.refreshBundle}
                        onAnimationEnd={() => this.setState({ spin: false })}
                      />
                      : ""
                    }
                  </div>
  
                </Paper>
                {this.state.viewBundle ? <div className="bundle-view">
                  <br></br>
                  <h3>Bundle</h3>
                  {this.renderBundle(this.props.specialtyRxBundle)}
                </div> : ""}
  
              </div>
            </div>
          }
          </div>
          :
          <div>
            No response - form has already been submitted previously....
          </div>
        }

      </div>
    )
  }
}
