#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    int negativos;
    int positivos;
    int num;
    
    cin >> positivos;
    for (int i = 0; i < 0; i++){
        if (num < 0){
            positivos++;
            cout << "positivos" << endl;
        } else{
            if (num > 0){
                negativos++;
                cout << "negativos" << endl;
            }
        }
        cout << positivos << negativos << endl;
    }
        return 0;
}