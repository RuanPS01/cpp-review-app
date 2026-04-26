#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    float min;
    
    cin >> min;
    
    float soma = 0;
    float quantidade = 0;
    int maior = 0;
    
    while(min != 0){
        
        soma += min;
        quantidade++;
        cin >> min;
    }
    
    cout << fixed << setprecision(2) << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2) << "Media dos tempos: " << soma / quantidade << " minutos" << endl;
    
    return 0;
}