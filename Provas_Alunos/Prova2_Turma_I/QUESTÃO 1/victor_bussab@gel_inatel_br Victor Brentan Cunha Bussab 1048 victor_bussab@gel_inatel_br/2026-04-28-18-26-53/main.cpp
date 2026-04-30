#include <iostream> 
using namespace std;

int main (){
    
    int num; // numero de quantidade de num de entrada
    int num_real; // numero que vai ser utilizando na conta
    int x = 0; //quantidade de numeros que sao divisiveis por 3
    
    cin >> num;
    
    for(int i = 0; i < num; i++){
        cin >> num_real;
        if(num_real / 3 == 1){
            x++;
        }
    }
    cout << x << endl;
    return 0;
}