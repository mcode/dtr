import * as React from 'react';
import { Dialog, DialogContent, DialogContentText, DialogTitle, DialogActions, Button } from '@material-ui/core';

export default function AlertDialog(props) {
  const { title, rxAlert, setRxAlert } = props;

  const handleClose = () => {
    setRxAlert({ open: false });
  };
  return (
    <div>
      <Dialog
        open={rxAlert.open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {rxAlert.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          {rxAlert.callback ?
            <Button onClick={rxAlert.callback} autoFocus>
              Yes
            </Button>
            :
            null}
        </DialogActions>
      </Dialog>
    </div>
  );
}