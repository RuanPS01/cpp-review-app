#include <iostream>
using namespace std;
int main(){
    
    int nota = 0, um = 0, dois = 0, tres = 0, quatro = 0, cinco = 0, i = 0;
    
    for( i; nota < 6; i++){
        cin >> nota;
        if(nota == 1){
            um++;
        }
            if(nota == 2){
                dois++;
            }    
                if(nota == 3){
                    tres++;
                }
                    if(nota == 4){
                        quatro++;
                    }
                        if(nota == 5){
                            cinco++;
                        }
    }
    
    um = (um / i) * 100;
    dois = (dois / i) * 100;
    tres = (tres / i) * 100;
    quatro = (quatro / i) * 100;
    cinco = (cinco / i) * 100;
    
    cout << "1 estrela: " << um << "%" << endl;
    cout << "2 estrela: " << dois << "%" << endl;
    cout << "3 estrela: " << tres << "%" << endl;
    cout << "4 estrela: " << quatro << "%" << endl;
    cout << "5 estrela: " << cinco << "%" << endl;
    
}