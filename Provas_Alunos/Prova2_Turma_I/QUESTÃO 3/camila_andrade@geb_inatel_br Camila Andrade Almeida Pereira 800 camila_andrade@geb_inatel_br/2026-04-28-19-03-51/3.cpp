#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    int n;
    int cont;
    float soma = 0;
    cin >> n;
    
    while(n < 6){
        soma += cont;
        cont ++;
        cin >> n;
        
        cout << fixed << setprecision(2);
        if(n == 1){
            cout << "1 estrela: " << cont << "% " << endl;
        }
        else if(n == 2){
            cout << "2 estrelas: " << cont << "%" << endl;
        }
        else if(n == 3){
            cout << "3 estrelas: " << cont << "%" << endl;
        }
        else{
            cout << "4 estrelas: " << cont << "%" << endl;
        }
    }
    
    
   return 0; 
}